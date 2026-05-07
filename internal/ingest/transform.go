package ingest

import (
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

var nullValues = map[string]bool{
	"":     true,
	`\N`:   true,
	"null": true,
	"NULL": true,
	"NA":   true,
}

var dateFormats = []string{
	"2006-01-02",
	"2006-01",
	"2006",
	"2006-01-02T15:04:05Z",
	"2006-01-02T15:04:05-07:00",
}

func parseDate(s string) (time.Time, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, false
	}

	// Handle ranges like "2006-01-02/2006-01-05" — use start date
	if idx := strings.Index(s, "/"); idx != -1 {
		s = s[:idx]
	}

	for _, layout := range dateFormats {
		if t, err := time.Parse(layout, s); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func parseFloat(s string) (float64, bool) {
	s = strings.TrimSpace(s)
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return f, true
}

func parseInt(s string) (int64, bool) {
	s = strings.TrimSpace(s)
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, false
	}
	return n, true
}

type fieldType int

const (
	ftString fieldType = iota
	ftDate
	ftFloat
	ftInt
)

type FieldSchema struct {
	Name string
	Type fieldType
}

type CollectionSchema struct {
	Fields []FieldSchema
}

func coerceRecord(record map[string]string, schema CollectionSchema) bson.M {
	doc := bson.M{}

	schemaMap := make(map[string]fieldType, len(schema.Fields))
	for _, f := range schema.Fields {
		schemaMap[f.Name] = f.Type
	}

	for k, v := range record {
		if nullValues[v] {
			continue
		}

		ft, hasSchema := schemaMap[k]
		if !hasSchema {
			ft = ftString
		}

		switch ft {
		case ftDate:
			if t, ok := parseDate(v); ok {
				doc[k] = t
			} else {
				doc[k] = v
			}
		case ftFloat:
			if f, ok := parseFloat(v); ok {
				doc[k] = f
			} else {
				doc[k] = v
			}
		case ftInt:
			if n, ok := parseInt(v); ok {
				doc[k] = n
			} else {
				doc[k] = v
			}
		default:
			doc[k] = v
		}
	}

	return doc
}
