package duckstore

import (
	"context"
	"database/sql"
	"strings"
	"time"
)

type RunRecord struct {
	ID           string
	Source       string
	Tipo         string
	Binary       string
	Version      string
	StartedAt    time.Time
	FinishedAt   time.Time
	DurationSec  float64
	Status       string
	ExitCode     int
	ErrorMessage string
	DryRun       bool
	DwCA         DwCAInfo
	Counters     Counters
	Warnings     []string
}

type DwCAInfo struct {
	URL             string
	DownloadedBytes int64
	PackageID       string
	PubDate         string
	Version         string
	Title           string
}

type Counters struct {
	RecordsRead                   int64
	RecordsRejected               int64
	RecordsInserted               int64
	RecordsUpdated                int64
	RecordsUpserted               int64
	RecordsRemoved                int64
	RecordsWithSuspectCoordinates int64
	RecordsWithUnknownFields      int64
}

// WriteRun appends one audit row to ingest_runs. The nested DwCAInfo and
// Counters are flattened into the single table.
func (s *Store) WriteRun(ctx context.Context, run RunRecord) error {
	var finishedAt any
	if !run.FinishedAt.IsZero() {
		finishedAt = run.FinishedAt
	}

	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO ingest_runs (
			"id", "source", "tipo", "binary", "version", "startedAt", "finishedAt", "durationSec",
			"status", "exitCode", "errorMessage", "dryRun",
			"dwcaUrl", "dwcaDownloadedBytes", "dwcaPackageId", "dwcaPubDate", "dwcaVersion", "dwcaTitle",
			"recordsRead", "recordsRejected", "recordsInserted", "recordsUpdated", "recordsUpserted",
			"recordsRemoved", "recordsWithSuspectCoordinates", "recordsWithUnknownFields", "warnings"
		) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		run.ID, run.Source, run.Tipo, run.Binary, run.Version, run.StartedAt, finishedAt, run.DurationSec,
		run.Status, run.ExitCode, run.ErrorMessage, run.DryRun,
		run.DwCA.URL, run.DwCA.DownloadedBytes, run.DwCA.PackageID, run.DwCA.PubDate, run.DwCA.Version, run.DwCA.Title,
		run.Counters.RecordsRead, run.Counters.RecordsRejected, run.Counters.RecordsInserted, run.Counters.RecordsUpdated,
		run.Counters.RecordsUpserted, run.Counters.RecordsRemoved, run.Counters.RecordsWithSuspectCoordinates,
		run.Counters.RecordsWithUnknownFields, strings.Join(run.Warnings, "\n"),
	)
	return err
}

// LastSuccessfulRun returns the most recent successful ingest_runs row for
// source, used to skip re-ingesting an unchanged dataset version.
func (s *Store) LastSuccessfulRun(ctx context.Context, source string) (*RunRecord, error) {
	row := s.DB.QueryRowContext(ctx, `
		SELECT "id", "source", "tipo", "binary", "version", "startedAt", "finishedAt", "durationSec",
			"status", "exitCode", "errorMessage", "dryRun",
			"dwcaUrl", "dwcaDownloadedBytes", "dwcaPackageId", "dwcaPubDate", "dwcaVersion", "dwcaTitle",
			"recordsRead", "recordsRejected", "recordsInserted", "recordsUpdated", "recordsUpserted",
			"recordsRemoved", "recordsWithSuspectCoordinates", "recordsWithUnknownFields", "warnings"
		FROM ingest_runs
		WHERE "source" = ? AND "status" = 'success'
		ORDER BY "startedAt" DESC
		LIMIT 1`, source)

	var run RunRecord
	var finishedAt sql.NullTime
	var warnings string
	err := row.Scan(
		&run.ID, &run.Source, &run.Tipo, &run.Binary, &run.Version, &run.StartedAt, &finishedAt, &run.DurationSec,
		&run.Status, &run.ExitCode, &run.ErrorMessage, &run.DryRun,
		&run.DwCA.URL, &run.DwCA.DownloadedBytes, &run.DwCA.PackageID, &run.DwCA.PubDate, &run.DwCA.Version, &run.DwCA.Title,
		&run.Counters.RecordsRead, &run.Counters.RecordsRejected, &run.Counters.RecordsInserted, &run.Counters.RecordsUpdated,
		&run.Counters.RecordsUpserted, &run.Counters.RecordsRemoved, &run.Counters.RecordsWithSuspectCoordinates,
		&run.Counters.RecordsWithUnknownFields, &warnings,
	)
	if err != nil {
		return nil, err
	}
	if finishedAt.Valid {
		run.FinishedAt = finishedAt.Time
	}
	if warnings != "" {
		run.Warnings = strings.Split(warnings, "\n")
	}
	return &run, nil
}
