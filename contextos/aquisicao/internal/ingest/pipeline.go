package ingest

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"biodiversidade-online/internal/config"
	"biodiversidade-online/internal/dwca"
	"biodiversidade-online/internal/mongostore"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

const progressLogThreshold = 50000

type RunConfig struct {
	Cfg            *config.Config
	Source         Source
	SourceID       string // overrides string(Source) as the "source" field value in documents
	IPTURLOverride string // overrides config URL for this run (used by multi-source occurrences)
	DryRun         bool
	Log            *slog.Logger
	Store          *mongostore.Store
	Binary         string
	Version        string
}

func Run(ctx context.Context, rc RunConfig) (mongostore.RunRecord, error) {
	runID := mongostore.NewRunID()
	started := time.Now()

	sourceStr := string(rc.Source)
	if rc.SourceID != "" {
		sourceStr = rc.SourceID
	}

	run := mongostore.RunRecord{
		ID:        runID,
		Source:    sourceStr,
		Binary:    rc.Binary,
		Version:   rc.Version,
		StartedAt: started,
		Status:    "failed",
		DryRun:    rc.DryRun,
	}

	iptURL := rc.IPTURLOverride
	if iptURL == "" {
		iptURL = iptURLForSource(rc.Cfg, rc.Source)
	}
	run.DwCA.URL = iptURL

	cacheDir := rc.Cfg.CacheDir
	if cacheDir == "" {
		userCache, err := os.UserCacheDir()
		if err != nil {
			userCache = os.TempDir()
		}
		cacheDir = filepath.Join(userCache, "biodiversidade")
	}

	// Download
	rc.Log.Info("baixando DwC-A", "url", iptURL)
	zipPath, err := dwca.Download(ctx, iptURL, cacheDir, rc.Cfg.HTTPTimeoutMin)
	if err != nil {
		run.ErrorMessage = err.Error()
		return run, fmt.Errorf("download: %w", err)
	}

	defer func() {
		if err := os.Remove(zipPath); err != nil && !os.IsNotExist(err) {
			rc.Log.Warn("falha ao deletar cache", "path", zipPath, "err", err)
		}
	}()

	info, _ := os.Stat(zipPath)
	if info != nil {
		run.DwCA.DownloadedBytes = info.Size()
		rc.Log.Info("DwC-A baixado", "bytes", info.Size(), "cache", zipPath)
	}

	// Open archive
	archive, err := dwca.Open(zipPath)
	if err != nil {
		run.ErrorMessage = err.Error()
		return run, fmt.Errorf("open archive: %w", err)
	}

	run.DwCA.PackageID = archive.Metadata.PackageID
	run.DwCA.PubDate = archive.Metadata.PubDate
	run.DwCA.Version = archive.Metadata.Version
	run.DwCA.Title = archive.Metadata.Title

	rc.Log.Info("lendo eml.xml",
		"packageId", archive.Metadata.PackageID,
		"pubDate", archive.Metadata.PubDate,
		"version", archive.Metadata.Version,
		"title", archive.Metadata.Title,
	)
	rc.Log.Info("lendo meta.xml",
		"core_rowtype", archive.Core.RowType,
		"fields", len(archive.Core.Fields),
		"extensions", len(archive.Extensions),
	)

	// Skip if dataset version unchanged since last successful ingest.
	// Uses packageId (EML root attribute) as primary version fingerprint.
	if !rc.DryRun && rc.Store != nil {
		if last, err := rc.Store.LastSuccessfulRun(ctx, sourceStr); err == nil {
			curPkg := archive.Metadata.PackageID
			if curPkg != "" && curPkg == last.DwCA.PackageID {
				rc.Log.Info("versao identica, fonte ignorada",
					"packageId", curPkg,
					"last_run_at", last.FinishedAt,
				)
				run.Status = "skipped"
				run.FinishedAt = time.Now()
				run.DurationSec = time.Since(started).Seconds()
				return run, nil
			}
		}
	}

	schema := schemaForSource(rc.Source)
	idField := rc.Source.IDField()

	var coll *mongo.Collection
	if rc.Store != nil {
		switch rc.Source.Collection() {
		case "taxa":
			coll = rc.Store.Taxa
		case "occurrences":
			coll = rc.Store.Occurrences
		}
	}

	rc.Log.Info("iniciando ingestao", "runId", runID, "dry_run", rc.DryRun)

	// Load taxon extensions into RAM (only for fauna/flora; occurrences don't use these).
	var taxonExt map[string]*taxonExtensions
	if rc.Source == SourceFauna || rc.Source == SourceFlora {
		taxonExt, err = loadTaxonExtensions(zipPath, archive)
		if err != nil {
			run.ErrorMessage = err.Error()
			return run, fmt.Errorf("load extensions: %w", err)
		}
		rc.Log.Info("extensoes carregadas",
			"taxa_with_extensions", len(taxonExt),
			"available_extensions", len(archive.Extensions),
		)
	}

	reader, err := dwca.CoreReader(zipPath)
	if err != nil {
		run.ErrorMessage = err.Error()
		return run, fmt.Errorf("core reader: %w", err)
	}
	defer reader.Close()

	batch := make([]bson.M, 0, rc.Cfg.BulkBatchSize)
	batchNum := 0
	var counters mongostore.Counters
	var warnings []string
	const maxWarnings = 100

	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		batchNum++
		rc.Log.Info("processando lote", "batch", batchNum, "size", len(batch))

		if !rc.DryRun && coll != nil {
			res, err := mongostore.BulkUpsert(ctx, coll, batch, runID, sourceStr)
			if err != nil {
				return fmt.Errorf("bulk upsert batch %d: %w", batchNum, err)
			}
			counters.RecordsInserted += res.Upserted
			counters.RecordsUpdated += res.Modified
			counters.RecordsUpserted += res.Upserted + res.Modified
			rc.Log.Info("lote gravado",
				"batch", batchNum,
				"inserted", res.Upserted,
				"updated", res.Modified,
			)
		}
		batch = batch[:0]
		return nil
	}

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			run.ErrorMessage = err.Error()
			return run, fmt.Errorf("read record: %w", err)
		}

		counters.RecordsRead++

		// Progress logging for high-volume sources
		if rc.Source == SourceOccurrences && counters.RecordsRead%progressLogThreshold == 0 {
			elapsed := time.Since(started).Seconds()
			rate := float64(counters.RecordsRead) / elapsed
			rc.Log.Info("progresso",
				"records_processed", counters.RecordsRead,
				"elapsed_sec", int(elapsed),
				"rate_per_sec", int(rate),
			)
		}

		// Filter taxa by rank: only species-level and below pass through.
		if rc.Source == SourceFauna || rc.Source == SourceFlora {
			if !shouldKeepTaxon(record["taxonRank"]) {
				counters.RecordsRejected++
				continue
			}
		}

		// Build document
		doc := coerceRecord(record, schema)

		// Set _id
		id, hasID := resolveID(doc, idField, sourceStr, record)
		if !hasID {
			counters.RecordsRejected++
			if len(warnings) < maxWarnings {
				warnings = append(warnings, fmt.Sprintf("missing ID at record %d", counters.RecordsRead))
			}
			continue
		}
		doc["_id"] = id

		// Validate required fields
		if rc.Source != SourceOccurrences {
			if _, ok := doc["scientificName"]; !ok {
				counters.RecordsRejected++
				continue
			}
		}

		// Enrich taxa documents with extensions and computed fields.
		if rc.Source == SourceFauna || rc.Source == SourceFlora {
			coreID := record["taxonID"]
			enrichTaxonDoc(doc, taxonExt[coreID])
		}

		// Validate coordinates for occurrences
		if rc.Source == SourceOccurrences {
			counters.RecordsWithSuspectCoordinates += checkCoordinates(doc, counters.RecordsRead, rc.Log, &warnings, maxWarnings)
		}

		batch = append(batch, doc)

		if len(batch) >= rc.Cfg.BulkBatchSize {
			if err := flush(); err != nil {
				run.ErrorMessage = err.Error()
				return run, err
			}

			// Yield to GC periodically
			if counters.RecordsRead%100000 == 0 {
				runtime.GC()
			}
		}
	}

	if err := flush(); err != nil {
		run.ErrorMessage = err.Error()
		return run, err
	}

	// Delete-not-seen
	if !rc.DryRun && coll != nil {
		rc.Log.Info("delete-not-seen iniciado", "source", sourceStr)
		removed, err := mongostore.DeleteNotSeen(ctx, coll, sourceStr, runID)
		if err != nil {
			run.ErrorMessage = err.Error()
			return run, fmt.Errorf("delete-not-seen: %w", err)
		}
		counters.RecordsRemoved = removed
		rc.Log.Info("delete-not-seen concluido", "removed", removed)
	}

	run.FinishedAt = time.Now()
	run.DurationSec = run.FinishedAt.Sub(started).Seconds()
	run.Status = "success"
	run.ExitCode = 0
	run.Counters = counters
	run.Warnings = warnings

	rc.Log.Info("concluido",
		"duration_sec", int(run.DurationSec),
		"records_read", counters.RecordsRead,
		"records_upserted", counters.RecordsUpserted,
		"records_rejected", counters.RecordsRejected,
		"records_removed", counters.RecordsRemoved,
		"exit_code", 0,
	)

	return run, nil
}

func iptURLForSource(cfg *config.Config, s Source) string {
	switch s {
	case SourceFauna:
		return cfg.IPTFaunaURL
	case SourceFlora:
		return cfg.IPTFloraURL
	case SourceOccurrences:
		return "" // occurrences uses IPTURLOverride from CSV, not a single config URL
	default:
		return ""
	}
}

func resolveID(doc bson.M, idField, source string, record map[string]string) (string, bool) {
	if v, ok := doc[idField]; ok {
		if s, ok := v.(string); ok && s != "" {
			return s, true
		}
	}

	// Fallback for taxa: source:scientificNameID
	if idField == "taxonID" {
		if snid, ok := record["scientificNameID"]; ok && snid != "" {
			return source + ":" + snid, true
		}
		// Last resort: hash of (scientificName, authorship, source)
		if sn, ok := record["scientificName"]; ok && sn != "" {
			auth := record["scientificNameAuthorship"]
			return source + ":" + sn + ":" + auth, true
		}
	}

	return "", false
}

func checkCoordinates(doc bson.M, recNum int64, log *slog.Logger, warnings *[]string, maxW int) int64 {
	lat, hasLat := doc["decimalLatitude"]
	lon, hasLon := doc["decimalLongitude"]

	if !hasLat && !hasLon {
		return 0
	}

	var suspect bool
	if hasLat {
		if f, ok := lat.(float64); ok {
			if f < -90 || f > 90 {
				suspect = true
			}
		}
	}
	if hasLon {
		if f, ok := lon.(float64); ok {
			if f < -180 || f > 180 {
				suspect = true
			}
		}
	}

	if suspect {
		log.Debug("coordenadas suspeitas", "record", recNum, "lat", lat, "lon", lon)
		if len(*warnings) < maxW {
			*warnings = append(*warnings, fmt.Sprintf("suspect coordinates at record %d: lat=%v lon=%v", recNum, lat, lon))
		}
		return 1
	}
	return 0
}
