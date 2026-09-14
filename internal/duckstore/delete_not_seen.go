package duckstore

import (
	"context"
	"fmt"
)

// DeleteNotSeenTaxon removes taxon rows scoped to datasetID that were not
// touched by runID (i.e. no longer present in the source), along with their
// extension rows (deleted first to satisfy the taxonID foreign keys).
func (s *Store) DeleteNotSeenTaxon(ctx context.Context, datasetID, runID string) (int64, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback() //nolint:errcheck

	for _, table := range extensionTables {
		q := fmt.Sprintf(`DELETE FROM %s WHERE "taxonID" IN (
			SELECT "taxonID" FROM taxon WHERE "datasetID" = ? AND "ingestRunId" <> ?
		)`, table)
		if _, err := tx.ExecContext(ctx, q, datasetID, runID); err != nil {
			return 0, fmt.Errorf("delete %s not-seen: %w", table, err)
		}
	}

	res, err := tx.ExecContext(ctx, `DELETE FROM taxon WHERE "datasetID" = ? AND "ingestRunId" <> ?`, datasetID, runID)
	if err != nil {
		return 0, fmt.Errorf("delete taxon not-seen: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return n, nil
}

// DeleteNotSeenOccurrence removes occurrence rows scoped to datasetID that
// were not touched by runID.
func (s *Store) DeleteNotSeenOccurrence(ctx context.Context, datasetID, runID string) (int64, error) {
	res, err := s.DB.ExecContext(ctx, `DELETE FROM occurrence WHERE "datasetID" = ? AND "ingestRunId" <> ?`, datasetID, runID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
