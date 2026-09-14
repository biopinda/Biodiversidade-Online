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
	"biodiversidade-online/internal/duckstore"
	"biodiversidade-online/internal/dwca"
)

const progressLogThreshold = 50000

type RunConfig struct {
	Cfg            *config.Config
	Source         Source
	SourceID       string // datasetID; overrides string(Source) as the "source" value in ingest_runs
	DatasetName    string // datasetName; the IPT source's display name (CSV "nome" column)
	Tipo           string // "taxa" or "ocorrencias", recorded on the ingest_runs audit row
	IPTURLOverride string // DwC-A download URL for this run (built from the IPT sources CSV)
	DryRun         bool
	Log            *slog.Logger
	Store          *duckstore.Store
	Binary         string
	Version        string
	ProgressFn     func(read, total int64) // progress callback; nil = disabled
	SilentPipeline bool                    // route verbose INFO logs to DEBUG
}

func Run(ctx context.Context, rc RunConfig) (duckstore.RunRecord, error) {
	runID := duckstore.NewRunID()
	started := time.Now()

	sourceStr := string(rc.Source)
	if rc.SourceID != "" {
		sourceStr = rc.SourceID
	}

	run := duckstore.RunRecord{
		ID:        runID,
		Source:    sourceStr,
		Tipo:      rc.Tipo,
		Binary:    rc.Binary,
		Version:   rc.Version,
		StartedAt: started,
		Status:    "failed",
		DryRun:    rc.DryRun,
	}

	// logVerbose routes to DEBUG when SilentPipeline is set (progress bars replace INFO output).
	logVerbose := rc.Log.Info
	if rc.SilentPipeline {
		logVerbose = rc.Log.Debug
	}

	iptURL := rc.IPTURLOverride
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
	logVerbose("baixando DwC-A", "url", iptURL)
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
		logVerbose("DwC-A baixado", "bytes", info.Size(), "cache", zipPath)
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

	logVerbose("lendo eml.xml",
		"packageId", archive.Metadata.PackageID,
		"pubDate", archive.Metadata.PubDate,
		"version", archive.Metadata.Version,
		"title", archive.Metadata.Title,
	)
	logVerbose("lendo meta.xml",
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
				logVerbose("versao identica, fonte ignorada",
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

	logVerbose("iniciando ingestao", "runId", runID, "dry_run", rc.DryRun)

	// Load taxon extensions into RAM (only for taxa; occurrences don't use these).
	var taxonExt map[string]*taxonExtensions
	if rc.Source == SourceTaxon {
		taxonExt, err = loadTaxonExtensions(zipPath, archive)
		if err != nil {
			run.ErrorMessage = err.Error()
			return run, fmt.Errorf("load extensions: %w", err)
		}
		logVerbose("extensoes carregadas",
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

	// Count total records and signal start of processing phase.
	var totalRecords int64
	if rc.ProgressFn != nil {
		totalRecords = dwca.CountCoreLines(zipPath, archive)
		rc.ProgressFn(0, totalRecords)
	}

	batch := make([]map[string]any, 0, rc.Cfg.BulkBatchSize)
	batchNum := 0
	var counters duckstore.Counters
	var warnings []string
	const maxWarnings = 100

	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		batchNum++
		logVerbose("processando lote", "batch", batchNum, "size", len(batch))

		if !rc.DryRun && rc.Store != nil {
			var res duckstore.UpsertResult
			var err error
			switch rc.Source {
			case SourceTaxon:
				res, err = rc.Store.UpsertTaxa(ctx, runID, batch)
			case SourceOccurrence:
				res, err = rc.Store.UpsertOccurrences(ctx, runID, batch)
			}
			if err != nil {
				return fmt.Errorf("upsert batch %d: %w", batchNum, err)
			}
			counters.RecordsInserted += res.Inserted
			counters.RecordsUpdated += res.Updated
			counters.RecordsUpserted += res.Inserted + res.Updated
			logVerbose("lote gravado",
				"batch", batchNum,
				"inserted", res.Inserted,
				"updated", res.Updated,
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

		if rc.ProgressFn != nil {
			if counters.RecordsRead%1000 == 0 {
				rc.ProgressFn(counters.RecordsRead, totalRecords)
			}
		} else if rc.Source == SourceOccurrence && counters.RecordsRead%progressLogThreshold == 0 {
			elapsed := time.Since(started).Seconds()
			rate := float64(counters.RecordsRead) / elapsed
			rc.Log.Info("progresso",
				"records_processed", counters.RecordsRead,
				"elapsed_sec", int(elapsed),
				"rate_per_sec", int(rate),
			)
		}

		// Filter taxa by rank: only species-level and below pass through.
		if rc.Source == SourceTaxon {
			if !shouldKeepTaxon(record["taxonRank"]) {
				counters.RecordsRejected++
				continue
			}
		}

		// Build document, dropping any field outside the fixed schema.
		doc, dropped := coerceRecord(record, schema)
		if dropped > 0 {
			counters.RecordsWithUnknownFields++
		}
		truncateLargeFields(doc)

		// Set the primary key column.
		id, hasID := resolveID(doc, idField, sourceStr, record)
		if !hasID {
			counters.RecordsRejected++
			if len(warnings) < maxWarnings {
				warnings = append(warnings, fmt.Sprintf("missing ID at record %d", counters.RecordsRead))
			}
			continue
		}
		doc[idField] = id
		doc["datasetID"] = sourceStr
		doc["datasetName"] = rc.DatasetName

		// Validate required fields
		if rc.Source != SourceOccurrence {
			if _, ok := doc["scientificName"]; !ok {
				counters.RecordsRejected++
				continue
			}
		}

		// Enrich taxa documents with extensions and computed fields.
		if rc.Source == SourceTaxon {
			coreID := record["taxonID"]
			enrichTaxonDoc(doc, taxonExt[coreID])
		}

		// Validate coordinates for occurrences
		if rc.Source == SourceOccurrence {
			suspect := checkCoordinates(doc, counters.RecordsRead, rc.Log, &warnings, maxWarnings)
			counters.RecordsWithSuspectCoordinates += suspect
			doc["hasSuspectCoordinates"] = suspect == 1
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
	if !rc.DryRun && rc.Store != nil {
		logVerbose("delete-not-seen iniciado", "source", sourceStr)
		var removed int64
		var err error
		switch rc.Source {
		case SourceTaxon:
			removed, err = rc.Store.DeleteNotSeenTaxon(ctx, sourceStr, runID)
		case SourceOccurrence:
			removed, err = rc.Store.DeleteNotSeenOccurrence(ctx, sourceStr, runID)
		}
		if err != nil {
			run.ErrorMessage = err.Error()
			return run, fmt.Errorf("delete-not-seen: %w", err)
		}
		counters.RecordsRemoved = removed
		logVerbose("delete-not-seen concluido", "removed", removed)
	}

	run.FinishedAt = time.Now()
	run.DurationSec = run.FinishedAt.Sub(started).Seconds()
	run.Status = "success"
	run.ExitCode = 0
	run.Counters = counters
	run.Warnings = warnings

	logVerbose("concluido",
		"duration_sec", int(run.DurationSec),
		"records_read", counters.RecordsRead,
		"records_upserted", counters.RecordsUpserted,
		"records_rejected", counters.RecordsRejected,
		"records_removed", counters.RecordsRemoved,
		"exit_code", 0,
	)

	return run, nil
}

func resolveID(doc map[string]any, idField, source string, record map[string]string) (string, bool) {
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

func checkCoordinates(doc map[string]any, recNum int64, log *slog.Logger, warnings *[]string, maxW int) int64 {
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
