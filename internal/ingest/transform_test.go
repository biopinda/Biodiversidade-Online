package ingest

import (
	"testing"
	"time"
)

func TestParseDate(t *testing.T) {
	tests := []struct {
		input    string
		wantZero bool
		wantYear int
	}{
		{"2026-04-30", false, 2026},
		{"2026-04", false, 2026},
		{"2026", false, 2026},
		{"2026-01-01/2026-12-31", false, 2026},
		{"", true, 0},
		{"not-a-date", true, 0},
		{`\N`, true, 0},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			got, ok := parseDate(tc.input)
			if tc.wantZero {
				if ok {
					t.Errorf("parseDate(%q) = %v, want failure", tc.input, got)
				}
				return
			}
			if !ok {
				t.Errorf("parseDate(%q) failed, want success", tc.input)
				return
			}
			if got.Year() != tc.wantYear {
				t.Errorf("parseDate(%q).Year() = %d, want %d", tc.input, got.Year(), tc.wantYear)
			}
		})
	}
}

func TestParseFloat(t *testing.T) {
	tests := []struct {
		input   string
		want    float64
		wantOK  bool
	}{
		{"3.14", 3.14, true},
		{"-23.5", -23.5, true},
		{"0", 0, true},
		{"", 0, false},
		{"abc", 0, false},
		{`\N`, 0, false},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			got, ok := parseFloat(tc.input)
			if ok != tc.wantOK {
				t.Errorf("parseFloat(%q) ok=%v, want %v", tc.input, ok, tc.wantOK)
			}
			if ok && got != tc.want {
				t.Errorf("parseFloat(%q) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}

func TestParseInt(t *testing.T) {
	tests := []struct {
		input  string
		want   int64
		wantOK bool
	}{
		{"42", 42, true},
		{"-1", -1, true},
		{"0", 0, true},
		{"", 0, false},
		{"3.14", 0, false},
		{"abc", 0, false},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			got, ok := parseInt(tc.input)
			if ok != tc.wantOK {
				t.Errorf("parseInt(%q) ok=%v, want %v", tc.input, ok, tc.wantOK)
			}
			if ok && got != tc.want {
				t.Errorf("parseInt(%q) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}

func TestCoerceRecord_OmitsNullValues(t *testing.T) {
	record := map[string]string{
		"taxonID":        "1",
		"scientificName": "Species one",
		"empty":          "",
		"nullVal":        `\N`,
		"nullStr":        "NULL",
	}

	schema := CollectionSchema{}
	doc := coerceRecord(record, schema)

	if _, ok := doc["empty"]; ok {
		t.Error("empty string should be omitted")
	}
	if _, ok := doc["nullVal"]; ok {
		t.Error(`\N should be omitted`)
	}
	if _, ok := doc["nullStr"]; ok {
		t.Error("NULL should be omitted")
	}
	if _, ok := doc["taxonID"]; !ok {
		t.Error("taxonID should be present")
	}
}

func TestCoerceRecord_TypeCoercions(t *testing.T) {
	record := map[string]string{
		"eventDate":       "2026-04-30",
		"decimalLatitude": "-23.5",
		"year":            "2026",
		"plain":           "text",
	}

	schema := occurrencesSchema
	doc := coerceRecord(record, schema)

	if _, ok := doc["eventDate"].(time.Time); !ok {
		t.Errorf("eventDate should be time.Time, got %T", doc["eventDate"])
	}
	if _, ok := doc["decimalLatitude"].(float64); !ok {
		t.Errorf("decimalLatitude should be float64, got %T", doc["decimalLatitude"])
	}
	if _, ok := doc["year"].(int64); !ok {
		t.Errorf("year should be int64, got %T", doc["year"])
	}
	if _, ok := doc["plain"].(string); !ok {
		t.Errorf("plain should be string, got %T", doc["plain"])
	}
}
