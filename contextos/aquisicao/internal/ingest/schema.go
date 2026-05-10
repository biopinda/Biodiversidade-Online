package ingest

type Source string

const (
	SourceFauna       Source = "fauna"
	SourceFlora       Source = "flora"
	SourceOccurrences Source = "occurrences"
)

func (s Source) Collection() string {
	switch s {
	case SourceFauna, SourceFlora:
		return "taxa"
	case SourceOccurrences:
		return "occurrences"
	default:
		return string(s)
	}
}

func (s Source) IDField() string {
	switch s {
	case SourceFauna, SourceFlora:
		return "taxonID"
	case SourceOccurrences:
		return "occurrenceID"
	default:
		return "id"
	}
}

// RowTypeForSource returns the expected DwC rowType for the archive core.
func RowTypeForSource(s Source) string {
	switch s {
	case SourceFauna, SourceFlora:
		return "http://rs.tdwg.org/dwc/terms/Taxon"
	case SourceOccurrences:
		return "http://rs.tdwg.org/dwc/terms/Occurrence"
	default:
		return ""
	}
}

// taxaSchema defines typed fields for the taxa collection.
var taxaSchema = CollectionSchema{
	Fields: []FieldSchema{
		{Name: "modified", Type: ftDate},
		{Name: "dateIdentified", Type: ftDate},
	},
}

// occurrencesSchema defines typed fields for the occurrences collection.
var occurrencesSchema = CollectionSchema{
	Fields: []FieldSchema{
		{Name: "eventDate", Type: ftDate},
		{Name: "dateIdentified", Type: ftDate},
		{Name: "decimalLatitude", Type: ftFloat},
		{Name: "decimalLongitude", Type: ftFloat},
		{Name: "coordinateUncertaintyInMeters", Type: ftFloat},
		{Name: "year", Type: ftInt},
		{Name: "month", Type: ftInt},
		{Name: "day", Type: ftInt},
		{Name: "individualCount", Type: ftInt},
	},
}

func schemaForSource(s Source) CollectionSchema {
	switch s {
	case SourceFauna, SourceFlora:
		return taxaSchema
	case SourceOccurrences:
		return occurrencesSchema
	default:
		return CollectionSchema{}
	}
}
