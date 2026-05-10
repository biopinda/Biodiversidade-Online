package dwca

import (
	"testing"
)

func TestOpen_ParsesMeta(t *testing.T) {
	zipPath := createFixture(t)

	archive, err := Open(zipPath)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	if got, want := archive.Core.RowType, "http://rs.tdwg.org/dwc/terms/Taxon"; got != want {
		t.Errorf("core rowType = %q, want %q", got, want)
	}

	if got := len(archive.Core.Fields); got != 4 {
		t.Errorf("fields count = %d, want 4", got)
	}

	if got, want := archive.Core.Files.Location, "taxa.txt"; got != want {
		t.Errorf("core file = %q, want %q", got, want)
	}
}

func TestOpen_ParsesEml(t *testing.T) {
	zipPath := createFixture(t)

	archive, err := Open(zipPath)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	if got, want := archive.Metadata.PubDate, "2026-04-30"; got != want {
		t.Errorf("pubDate = %q, want %q", got, want)
	}

	if got, want := archive.Metadata.Title, "Test Fauna Dataset"; got != want {
		t.Errorf("title = %q, want %q", got, want)
	}
}

func TestOpen_FieldMapping(t *testing.T) {
	zipPath := createFixture(t)

	archive, err := Open(zipPath)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	// Verify index 0 → taxonID
	found := false
	for _, f := range archive.Core.Fields {
		if f.Index == 0 && f.Term == "http://rs.tdwg.org/dwc/terms/taxonID" {
			found = true
			break
		}
	}
	if !found {
		t.Error("field index 0 should map to taxonID term")
	}
}
