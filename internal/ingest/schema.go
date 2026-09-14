package ingest

type Source string

const (
	SourceTaxon      Source = "taxon"
	SourceOccurrence Source = "occurrence"
)

// Collection returns the DuckDB table name for this source.
func (s Source) Collection() string {
	switch s {
	case SourceTaxon:
		return "taxon"
	case SourceOccurrence:
		return "occurrence"
	default:
		return string(s)
	}
}

// IDField returns the primary key column name for this source.
func (s Source) IDField() string {
	switch s {
	case SourceTaxon:
		return "taxonID"
	case SourceOccurrence:
		return "occurrenceID"
	default:
		return "id"
	}
}

// RowTypeForSource returns the expected DwC rowType for the archive core.
func RowTypeForSource(s Source) string {
	switch s {
	case SourceTaxon:
		return "http://rs.tdwg.org/dwc/terms/Taxon"
	case SourceOccurrence:
		return "http://rs.tdwg.org/dwc/terms/Occurrence"
	default:
		return ""
	}
}

// taxaSchema defines the fixed, full Darwin Core column list for the taxon
// table. Any raw record field not listed here is dropped by coerceRecord and
// counted toward recordsWithUnknownFields.
var taxaSchema = CollectionSchema{
	Fields: []FieldSchema{
		{Name: "taxonID", Type: ftString},
		{Name: "scientificName", Type: ftString},
		{Name: "scientificNameAuthorship", Type: ftString},
		{Name: "acceptedNameUsageID", Type: ftString},
		{Name: "parentNameUsageID", Type: ftString},
		{Name: "originalNameUsageID", Type: ftString},
		{Name: "kingdom", Type: ftString},
		{Name: "phylum", Type: ftString},
		{Name: "class", Type: ftString},
		{Name: "order", Type: ftString},
		{Name: "family", Type: ftString},
		{Name: "genus", Type: ftString},
		{Name: "subgenus", Type: ftString},
		{Name: "specificEpithet", Type: ftString},
		{Name: "infraspecificEpithet", Type: ftString},
		{Name: "taxonRank", Type: ftString},
		{Name: "verbatimTaxonRank", Type: ftString},
		{Name: "nomenclaturalCode", Type: ftString},
		{Name: "taxonomicStatus", Type: ftString},
		{Name: "nomenclaturalStatus", Type: ftString},
		{Name: "namePublishedIn", Type: ftString},
		{Name: "namePublishedInYear", Type: ftString},
		{Name: "higherClassification", Type: ftString},
		{Name: "taxonRemarks", Type: ftString},
		{Name: "references", Type: ftString},
		{Name: "modified", Type: ftDate},
		// Computed/provenance fields never appear in raw records but are
		// listed so they pass through unmolested if a source ever emits them.
		{Name: "canonicalName", Type: ftString},
		{Name: "flatScientificName", Type: ftString},
		{Name: "datasetID", Type: ftString},
		{Name: "datasetName", Type: ftString},
		{Name: "ingestRunId", Type: ftString},
		{Name: "ingestedAt", Type: ftDate},
	},
}

// occurrencesSchema defines the fixed, full Darwin Core column list for the
// occurrence table.
var occurrencesSchema = CollectionSchema{
	Fields: []FieldSchema{
		{Name: "occurrenceID", Type: ftString},
		{Name: "basisOfRecord", Type: ftString},
		{Name: "catalogNumber", Type: ftString},
		{Name: "recordNumber", Type: ftString},
		{Name: "recordedBy", Type: ftString},
		{Name: "individualCount", Type: ftInt},
		{Name: "sex", Type: ftString},
		{Name: "lifeStage", Type: ftString},
		{Name: "occurrenceStatus", Type: ftString},
		{Name: "preparations", Type: ftString},
		{Name: "associatedMedia", Type: ftString},
		{Name: "associatedSequences", Type: ftString},
		{Name: "associatedTaxa", Type: ftString},
		{Name: "eventDate", Type: ftDate},
		{Name: "eventTime", Type: ftString},
		{Name: "year", Type: ftInt},
		{Name: "month", Type: ftInt},
		{Name: "day", Type: ftInt},
		{Name: "verbatimEventDate", Type: ftString},
		{Name: "habitat", Type: ftString},
		{Name: "samplingProtocol", Type: ftString},
		{Name: "fieldNumber", Type: ftString},
		{Name: "fieldNotes", Type: ftString},
		{Name: "eventRemarks", Type: ftString},
		{Name: "continent", Type: ftString},
		{Name: "country", Type: ftString},
		{Name: "countryCode", Type: ftString},
		{Name: "stateProvince", Type: ftString},
		{Name: "county", Type: ftString},
		{Name: "municipality", Type: ftString},
		{Name: "locality", Type: ftString},
		{Name: "verbatimLocality", Type: ftString},
		{Name: "minimumElevationInMeters", Type: ftString},
		{Name: "maximumElevationInMeters", Type: ftString},
		{Name: "verbatimElevation", Type: ftString},
		{Name: "minimumDepthInMeters", Type: ftString},
		{Name: "maximumDepthInMeters", Type: ftString},
		{Name: "decimalLatitude", Type: ftFloat},
		{Name: "decimalLongitude", Type: ftFloat},
		{Name: "geodeticDatum", Type: ftString},
		{Name: "coordinateUncertaintyInMeters", Type: ftFloat},
		{Name: "coordinatePrecision", Type: ftString},
		{Name: "verbatimCoordinates", Type: ftString},
		{Name: "verbatimLatitude", Type: ftString},
		{Name: "verbatimLongitude", Type: ftString},
		{Name: "georeferencedBy", Type: ftString},
		{Name: "georeferenceProtocol", Type: ftString},
		{Name: "georeferenceVerificationStatus", Type: ftString},
		{Name: "identifiedBy", Type: ftString},
		{Name: "dateIdentified", Type: ftDate},
		{Name: "identificationRemarks", Type: ftString},
		{Name: "taxonID", Type: ftString},
		{Name: "scientificName", Type: ftString},
		{Name: "scientificNameAuthorship", Type: ftString},
		{Name: "kingdom", Type: ftString},
		{Name: "phylum", Type: ftString},
		{Name: "class", Type: ftString},
		{Name: "order", Type: ftString},
		{Name: "family", Type: ftString},
		{Name: "genus", Type: ftString},
		{Name: "specificEpithet", Type: ftString},
		{Name: "infraspecificEpithet", Type: ftString},
		{Name: "taxonRank", Type: ftString},
		{Name: "vernacularName", Type: ftString},
		{Name: "taxonRemarks", Type: ftString},
		{Name: "institutionCode", Type: ftString},
		{Name: "collectionCode", Type: ftString},
		{Name: "ownerInstitutionCode", Type: ftString},
		{Name: "datasetName", Type: ftString},
		{Name: "datasetID", Type: ftString},
		{Name: "informationWithheld", Type: ftString},
		{Name: "dataGeneralizations", Type: ftString},
		{Name: "dynamicProperties", Type: ftString},
		{Name: "otherCatalogNumbers", Type: ftString},
		{Name: "occurrenceRemarks", Type: ftString},
		// Computed/provenance fields never appear in raw records.
		{Name: "hasSuspectCoordinates", Type: ftString},
		{Name: "ingestRunId", Type: ftString},
		{Name: "ingestedAt", Type: ftDate},
	},
}

func schemaForSource(s Source) CollectionSchema {
	switch s {
	case SourceTaxon:
		return taxaSchema
	case SourceOccurrence:
		return occurrencesSchema
	default:
		return CollectionSchema{}
	}
}
