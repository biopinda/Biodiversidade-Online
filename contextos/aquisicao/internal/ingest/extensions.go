package ingest

import (
	"errors"
	"fmt"
	"io"

	"biodiversidade-online/internal/dwca"
)

const (
	rowTypeDistribution         = "http://rs.gbif.org/terms/1.0/Distribution"
	rowTypeVernacularName       = "http://rs.gbif.org/terms/1.0/VernacularName"
	rowTypeSpeciesProfile       = "http://rs.gbif.org/terms/1.0/SpeciesProfile"
	rowTypeReference            = "http://rs.gbif.org/terms/1.0/Reference"
	rowTypeTypesAndSpecimen     = "http://rs.gbif.org/terms/1.0/TypesAndSpecimen"
	rowTypeResourceRelationship = "http://rs.tdwg.org/dwc/terms/ResourceRelationship"
)

// taxonExtensions holds all extension records for a single core taxon, grouped by rowType.
type taxonExtensions struct {
	Distribution         []map[string]string
	Vernacular           []map[string]string
	SpeciesProfile       []map[string]string
	Reference            []map[string]string
	TypesAndSpecimen     []map[string]string
	ResourceRelationship []map[string]string
}

// loadTaxonExtensions reads all known taxon extensions from the archive into RAM,
// keyed by core ID (taxonID). Missing extensions are silently skipped.
func loadTaxonExtensions(zipPath string, archive *dwca.Archive) (map[string]*taxonExtensions, error) {
	result := make(map[string]*taxonExtensions)

	available := make(map[string]bool, len(archive.Extensions))
	for _, ext := range archive.Extensions {
		available[ext.RowType] = true
	}

	loaders := []struct {
		rowType string
		assign  func(te *taxonExtensions, rec map[string]string)
	}{
		{rowTypeDistribution, func(te *taxonExtensions, rec map[string]string) {
			te.Distribution = append(te.Distribution, rec)
		}},
		{rowTypeVernacularName, func(te *taxonExtensions, rec map[string]string) {
			te.Vernacular = append(te.Vernacular, rec)
		}},
		{rowTypeSpeciesProfile, func(te *taxonExtensions, rec map[string]string) {
			te.SpeciesProfile = append(te.SpeciesProfile, rec)
		}},
		{rowTypeReference, func(te *taxonExtensions, rec map[string]string) {
			te.Reference = append(te.Reference, rec)
		}},
		{rowTypeTypesAndSpecimen, func(te *taxonExtensions, rec map[string]string) {
			te.TypesAndSpecimen = append(te.TypesAndSpecimen, rec)
		}},
		{rowTypeResourceRelationship, func(te *taxonExtensions, rec map[string]string) {
			te.ResourceRelationship = append(te.ResourceRelationship, rec)
		}},
	}

	for _, ld := range loaders {
		if !available[ld.rowType] {
			continue
		}
		if err := readExtension(zipPath, ld.rowType, result, ld.assign); err != nil {
			return nil, fmt.Errorf("read extension %s: %w", ld.rowType, err)
		}
	}

	return result, nil
}

func readExtension(
	zipPath, rowType string,
	out map[string]*taxonExtensions,
	assign func(te *taxonExtensions, rec map[string]string),
) error {
	reader, err := dwca.ExtensionReader(zipPath, rowType)
	if err != nil {
		return err
	}
	defer reader.Close()

	for {
		rec, err := reader.Read()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
		coreID := rec["id"]
		if coreID == "" {
			// Some archives place coreid under taxonID column already mapped
			coreID = rec["taxonID"]
		}
		if coreID == "" {
			continue
		}
		te, ok := out[coreID]
		if !ok {
			te = &taxonExtensions{}
			out[coreID] = te
		}
		assign(te, rec)
	}
}
