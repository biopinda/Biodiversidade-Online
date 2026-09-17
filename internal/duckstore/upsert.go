package duckstore

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// taxonColumns and occurrenceColumns list every fixed Darwin Core column, in
// the exact order used to build INSERT statements. Keep in sync with schema.go.
var taxonColumns = []string{
	"taxonID", "scientificName", "scientificNameAuthorship", "acceptedNameUsageID", "parentNameUsageID",
	"originalNameUsageID", "kingdom", "phylum", "class", "order", "family", "genus", "subgenus",
	"specificEpithet", "infraspecificEpithet", "taxonRank", "verbatimTaxonRank", "nomenclaturalCode",
	"taxonomicStatus", "nomenclaturalStatus", "namePublishedIn", "namePublishedInYear", "higherClassification",
	"taxonRemarks", "references", "modified", "canonicalName", "flatScientificName", "datasetID", "datasetName",
	"ingestRunId", "ingestedAt",
}

var occurrenceColumns = []string{
	"occurrenceID", "basisOfRecord", "catalogNumber", "recordNumber", "recordedBy", "individualCount", "sex",
	"lifeStage", "occurrenceStatus", "preparations", "associatedMedia", "associatedSequences", "associatedTaxa",
	"eventDate", "eventTime", "year", "month", "day", "verbatimEventDate", "habitat", "samplingProtocol",
	"fieldNumber", "fieldNotes", "eventRemarks", "continent", "country", "countryCode", "stateProvince",
	"county", "municipality", "locality", "verbatimLocality", "minimumElevationInMeters", "maximumElevationInMeters",
	"verbatimElevation", "minimumDepthInMeters", "maximumDepthInMeters", "decimalLatitude", "decimalLongitude",
	"geodeticDatum", "coordinateUncertaintyInMeters", "coordinatePrecision", "verbatimCoordinates",
	"verbatimLatitude", "verbatimLongitude", "georeferencedBy", "georeferenceProtocol",
	"georeferenceVerificationStatus", "identifiedBy", "dateIdentified", "identificationRemarks", "taxonID",
	"scientificName", "scientificNameAuthorship", "kingdom", "phylum", "class", "order", "family", "genus",
	"specificEpithet", "infraspecificEpithet", "taxonRank", "vernacularName", "taxonRemarks", "institutionCode",
	"collectionCode", "ownerInstitutionCode", "datasetName", "datasetID", "informationWithheld",
	"dataGeneralizations", "dynamicProperties", "otherCatalogNumbers", "occurrenceRemarks",
	"hasSuspectCoordinates", "ingestRunId", "ingestedAt",
}

var extensionTables = []string{
	"taxon_distribution", "taxon_species_profile", "taxon_vernacular_name",
	"taxon_reference", "taxon_types_and_specimen", "taxon_resource_relationship",
}

// UpsertResult reports how many rows a batch inserted versus updated.
type UpsertResult struct {
	Inserted int64
	Updated  int64
}

// upsertChunkSize caps how many rows go into a single multi-row INSERT
// statement. DuckDB's local-transaction constraint checking degrades
// superlinearly with rows-per-statement (measured: chunk=500 -> 17.9ms/row,
// chunk=20 -> ~0.4ms/row for a 78-column table), so batches stay small.
const upsertChunkSize = 20

// insertValuesSQL builds `INSERT INTO table (...) VALUES (...),(...),...`
// for `rows` value tuples of cols.
func insertValuesSQL(table string, cols []string, rows int) string {
	quoted := make([]string, len(cols))
	for i, c := range cols {
		quoted[i] = `"` + c + `"`
	}
	tuple := "(" + strings.TrimSuffix(strings.Repeat("?,", len(cols)), ",") + ")"
	values := make([]string, rows)
	for i := range values {
		values[i] = tuple
	}
	return fmt.Sprintf(`INSERT INTO %s (%s) VALUES %s`, table, strings.Join(quoted, ","), strings.Join(values, ","))
}

// deleteByIDs removes any existing rows matching ids from table, ahead of a
// bulk re-insert. Upserting via DuckDB's `ON CONFLICT DO UPDATE` measured
// ~400ms/row on this driver (a full local-storage constraint re-check per
// statement); delete-then-insert avoids that path entirely and measured
// ~750us/row for the same workload.
func deleteByIDs(ctx context.Context, tx *sql.Tx, table, pk string, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	_, err := tx.ExecContext(ctx,
		fmt.Sprintf(`DELETE FROM %s WHERE "%s" IN (%s)`, table, pk, strings.Join(placeholders, ",")), args...)
	return err
}

// execBatchUpsert upserts docs into table by deleting any pre-existing rows
// (by ids) and bulk re-inserting all docs in chunks of upsertChunkSize rows.
func execBatchUpsert(ctx context.Context, tx *sql.Tx, table string, cols []string, ids []string, docs []map[string]any) error {
	if err := deleteByIDs(ctx, tx, table, cols[0], ids); err != nil {
		return fmt.Errorf("delete existing %s rows: %w", table, err)
	}
	for start := 0; start < len(docs); start += upsertChunkSize {
		end := start + upsertChunkSize
		if end > len(docs) {
			end = len(docs)
		}
		chunk := docs[start:end]
		args := make([]any, 0, len(chunk)*len(cols))
		for _, d := range chunk {
			args = append(args, columnValues(d, cols)...)
		}
		if _, err := tx.ExecContext(ctx, insertValuesSQL(table, cols, len(chunk)), args...); err != nil {
			return fmt.Errorf("batch insert %s: %w", table, err)
		}
	}
	return nil
}

func collectIDs(docs []map[string]any, key string) []string {
	ids := make([]string, 0, len(docs))
	for _, d := range docs {
		if id, ok := d[key].(string); ok && id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

func columnValues(doc map[string]any, cols []string) []any {
	values := make([]any, len(cols))
	for i, c := range cols {
		values[i] = doc[c]
	}
	return values
}

// existingIDs returns the subset of ids already present in table, used to
// split a batch's upsert result into inserted vs updated counts.
func existingIDs(ctx context.Context, tx *sql.Tx, table, pk string, ids []string) (map[string]bool, error) {
	out := make(map[string]bool, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	rows, err := tx.QueryContext(ctx,
		fmt.Sprintf(`SELECT "%s" FROM %s WHERE "%s" IN (%s)`, pk, table, pk, strings.Join(placeholders, ",")), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

// UpsertTaxa writes a batch of taxon documents plus their extension rows
// (distribution, vernacular names, species profile, references, types and
// specimen, resource relationships) inside one transaction.
func (s *Store) UpsertTaxa(ctx context.Context, runID string, docs []map[string]any) (UpsertResult, error) {
	if len(docs) == 0 {
		return UpsertResult{}, nil
	}
	now := time.Now().UTC()
	ids := collectIDs(docs, "taxonID")

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return UpsertResult{}, err
	}
	defer tx.Rollback() //nolint:errcheck

	existing, err := existingIDs(ctx, tx, "taxon", "taxonID", ids)
	if err != nil {
		return UpsertResult{}, fmt.Errorf("check existing taxa: %w", err)
	}

	if err := deleteExtensionsBatch(ctx, tx, ids); err != nil {
		return UpsertResult{}, err
	}

	for _, d := range docs {
		d["ingestRunId"] = runID
		d["ingestedAt"] = now
	}
	if err := execBatchUpsert(ctx, tx, "taxon", taxonColumns, ids, docs); err != nil {
		return UpsertResult{}, fmt.Errorf("upsert taxa: %w", err)
	}

	ext, err := prepareExtensionStmts(ctx, tx)
	if err != nil {
		return UpsertResult{}, err
	}
	defer ext.Close()

	var inserted, updated int64
	for _, d := range docs {
		taxonID, _ := d["taxonID"].(string)
		if existing[taxonID] {
			updated++
		} else {
			inserted++
		}

		if err := ext.write(ctx, taxonID, d); err != nil {
			return UpsertResult{}, fmt.Errorf("write extensions for %s: %w", taxonID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return UpsertResult{}, err
	}
	return UpsertResult{Inserted: inserted, Updated: updated}, nil
}

// UpsertOccurrences writes a batch of occurrence documents inside one transaction.
func (s *Store) UpsertOccurrences(ctx context.Context, runID string, docs []map[string]any) (UpsertResult, error) {
	if len(docs) == 0 {
		return UpsertResult{}, nil
	}
	now := time.Now().UTC()
	ids := collectIDs(docs, "occurrenceID")

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return UpsertResult{}, err
	}
	defer tx.Rollback() //nolint:errcheck

	existing, err := existingIDs(ctx, tx, "occurrence", "occurrenceID", ids)
	if err != nil {
		return UpsertResult{}, fmt.Errorf("check existing occurrences: %w", err)
	}

	for _, d := range docs {
		d["ingestRunId"] = runID
		d["ingestedAt"] = now
	}
	if err := execBatchUpsert(ctx, tx, "occurrence", occurrenceColumns, ids, docs); err != nil {
		return UpsertResult{}, fmt.Errorf("upsert occurrences: %w", err)
	}

	var inserted, updated int64
	for _, d := range docs {
		id, _ := d["occurrenceID"].(string)
		if existing[id] {
			updated++
		} else {
			inserted++
		}
	}

	if err := tx.Commit(); err != nil {
		return UpsertResult{}, err
	}
	return UpsertResult{Inserted: inserted, Updated: updated}, nil
}

func deleteExtensionsBatch(ctx context.Context, tx *sql.Tx, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	in := strings.Join(placeholders, ",")
	for _, table := range extensionTables {
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`DELETE FROM %s WHERE "taxonID" IN (%s)`, table, in), args...); err != nil {
			return fmt.Errorf("delete %s: %w", table, err)
		}
	}
	return nil
}

// extensionStmts holds one prepared INSERT per taxon extension table, reused
// across an entire batch for performance.
type extensionStmts struct {
	distribution   *sql.Stmt
	speciesProfile *sql.Stmt
	vernacular     *sql.Stmt
	reference      *sql.Stmt
	types          *sql.Stmt
	relationship   *sql.Stmt
}

func prepareExtensionStmts(ctx context.Context, tx *sql.Tx) (*extensionStmts, error) {
	var e extensionStmts
	var err error

	if e.distribution, err = tx.PrepareContext(ctx, `INSERT INTO taxon_distribution
		("taxonID","origin","endemism","phytogeographicDomains","vegetationType","countryCode","occurrence")
		VALUES (?,?,?,?,?,?,?)`); err != nil {
		return nil, fmt.Errorf("prepare taxon_distribution: %w", err)
	}
	if e.speciesProfile, err = tx.PrepareContext(ctx, `INSERT INTO taxon_species_profile
		("taxonID","lifeForm","habitat") VALUES (?,?,?)`); err != nil {
		return nil, fmt.Errorf("prepare taxon_species_profile: %w", err)
	}
	if e.vernacular, err = tx.PrepareContext(ctx, `INSERT INTO taxon_vernacular_name
		("taxonID","vernacularName","language","locality") VALUES (?,?,?,?)`); err != nil {
		return nil, fmt.Errorf("prepare taxon_vernacular_name: %w", err)
	}
	if e.reference, err = tx.PrepareContext(ctx, `INSERT INTO taxon_reference
		("taxonID","bibliographicCitation","title","creator","date","type","identifier") VALUES (?,?,?,?,?,?,?)`); err != nil {
		return nil, fmt.Errorf("prepare taxon_reference: %w", err)
	}
	if e.types, err = tx.PrepareContext(ctx, `INSERT INTO taxon_types_and_specimen
		("taxonID","locality","recordedBy","catalogNumber","collectionCode","source","typeStatus") VALUES (?,?,?,?,?,?,?)`); err != nil {
		return nil, fmt.Errorf("prepare taxon_types_and_specimen: %w", err)
	}
	if e.relationship, err = tx.PrepareContext(ctx, `INSERT INTO taxon_resource_relationship
		("taxonID","relatedTaxonID","scientificName","taxonomicStatus") VALUES (?,?,?,?)`); err != nil {
		return nil, fmt.Errorf("prepare taxon_resource_relationship: %w", err)
	}
	return &e, nil
}

func (e *extensionStmts) Close() {
	for _, st := range []*sql.Stmt{e.distribution, e.speciesProfile, e.vernacular, e.reference, e.types, e.relationship} {
		if st != nil {
			st.Close()
		}
	}
}

// write inserts extension rows for taxonID from the enriched taxon doc.
// doc carries the shapes produced by taxa_transform.go's normalize* helpers:
// "distribution" (map), "speciesprofile" (map with nested "lifeForm" map),
// "vernacularname"/"reference"/"typesandspecimen"/"othernames" ([]map).
func (e *extensionStmts) write(ctx context.Context, taxonID string, doc map[string]any) error {
	if dist, ok := doc["distribution"].(map[string]any); ok && dist != nil {
		if _, err := e.distribution.ExecContext(ctx, taxonID,
			strVal(dist["origin"]), strVal(dist["Endemism"]),
			sliceVal(strSlice(dist["phytogeographicDomains"])),
			sliceVal(strSlice(dist["vegetationType"])),
			sliceVal(strSlice(dist["countryCode"])),
			sliceVal(strSlice(dist["occurrence"])),
		); err != nil {
			return fmt.Errorf("taxon_distribution: %w", err)
		}
	}

	if prof, ok := doc["speciesprofile"].(map[string]any); ok && prof != nil {
		var lifeForm, habitat []string
		if inner, ok := prof["lifeForm"].(map[string]any); ok && inner != nil {
			lifeForm = strSlice(inner["lifeForm"])
			habitat = strSlice(inner["habitat"])
		}
		if _, err := e.speciesProfile.ExecContext(ctx, taxonID, sliceVal(lifeForm), sliceVal(habitat)); err != nil {
			return fmt.Errorf("taxon_species_profile: %w", err)
		}
	}

	if verns, ok := doc["vernacularname"].([]map[string]any); ok {
		for _, v := range verns {
			if _, err := e.vernacular.ExecContext(ctx, taxonID,
				strVal(v["vernacularName"]), strVal(v["language"]), strVal(v["locality"]),
			); err != nil {
				return fmt.Errorf("taxon_vernacular_name: %w", err)
			}
		}
	}

	if refs, ok := doc["reference"].([]map[string]any); ok {
		for _, r := range refs {
			if _, err := e.reference.ExecContext(ctx, taxonID,
				strVal(r["bibliographicCitation"]), strVal(r["title"]), strVal(r["creator"]),
				strVal(r["date"]), strVal(r["type"]), strVal(r["identifier"]),
			); err != nil {
				return fmt.Errorf("taxon_reference: %w", err)
			}
		}
	}

	if types, ok := doc["typesandspecimen"].([]map[string]any); ok {
		for _, t := range types {
			if _, err := e.types.ExecContext(ctx, taxonID,
				strVal(t["locality"]), strVal(t["recordedBy"]), strVal(t["catalogNumber"]),
				strVal(t["collectionCode"]), strVal(t["source"]), strVal(t["typeStatus"]),
			); err != nil {
				return fmt.Errorf("taxon_types_and_specimen: %w", err)
			}
		}
	}

	if others, ok := doc["othernames"].([]map[string]any); ok {
		for _, o := range others {
			if _, err := e.relationship.ExecContext(ctx, taxonID,
				strVal(o["taxonID"]), strVal(o["scientificName"]), strVal(o["taxonomicStatus"]),
			); err != nil {
				return fmt.Errorf("taxon_resource_relationship: %w", err)
			}
		}
	}

	return nil
}

func strVal(v any) any {
	if s, ok := v.(string); ok && s != "" {
		return s
	}
	return nil
}

func strSlice(v any) []string {
	s, _ := v.([]string)
	return s
}

func sliceVal(s []string) any {
	if len(s) == 0 {
		return nil
	}
	return s
}
