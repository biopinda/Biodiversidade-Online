package dwca

import "encoding/xml"

type Archive struct {
	XMLName    xml.Name    `xml:"archive"`
	Core       Core        `xml:"core"`
	Extensions []Extension `xml:"extension"`
	Metadata   EmlMetadata
}

type Core struct {
	RowType            string  `xml:"rowType,attr"`
	FieldsTerminatedBy string  `xml:"fieldsTerminatedBy,attr"`
	LinesTerminatedBy  string  `xml:"linesTerminatedBy,attr"`
	Encoding           string  `xml:"encoding,attr"`
	IgnoreHeaderLines  int     `xml:"ignoreHeaderLines,attr"`
	Files              Files   `xml:"files"`
	ID                 IDField `xml:"id"`
	Fields             []Field `xml:"field"`
}

type Extension struct {
	RowType            string  `xml:"rowType,attr"`
	FieldsTerminatedBy string  `xml:"fieldsTerminatedBy,attr"`
	LinesTerminatedBy  string  `xml:"linesTerminatedBy,attr"`
	Encoding           string  `xml:"encoding,attr"`
	IgnoreHeaderLines  int     `xml:"ignoreHeaderLines,attr"`
	Files              Files   `xml:"files"`
	CoreID             IDField `xml:"coreid"`
	Fields             []Field `xml:"field"`
}

type Files struct {
	Location string `xml:"location"`
}

type IDField struct {
	Index int `xml:"index,attr"`
}

type Field struct {
	Index   int    `xml:"index,attr"`
	Term    string `xml:"term,attr"`
	Default string `xml:"default,attr"`
}

type EmlMetadata struct {
	PackageID string
	PubDate   string
	Version   string
	Title     string
}
