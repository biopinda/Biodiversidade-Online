package dwca

import (
	"io"
	"testing"
)

func TestCoreReader_ReadsAllRecords(t *testing.T) {
	zipPath := createFixture(t)

	reader, err := CoreReader(zipPath)
	if err != nil {
		t.Fatalf("CoreReader: %v", err)
	}
	defer reader.Close()

	var count int
	for {
		rec, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("Read: %v", err)
		}
		count++
		_ = rec
	}

	if count != 5 {
		t.Errorf("read %d records, want 5", count)
	}
}

func TestCoreReader_MapsTerms(t *testing.T) {
	zipPath := createFixture(t)

	reader, err := CoreReader(zipPath)
	if err != nil {
		t.Fatalf("CoreReader: %v", err)
	}
	defer reader.Close()

	rec, err := reader.Read()
	if err != nil {
		t.Fatalf("Read first record: %v", err)
	}

	if got, want := rec["taxonID"], "1"; got != want {
		t.Errorf("taxonID = %q, want %q", got, want)
	}
	if got, want := rec["scientificName"], "Species one"; got != want {
		t.Errorf("scientificName = %q, want %q", got, want)
	}
	if got, want := rec["kingdom"], "Animalia"; got != want {
		t.Errorf("kingdom = %q, want %q", got, want)
	}
}

func TestCoreReader_ReturnsEOF(t *testing.T) {
	zipPath := createFixture(t)

	reader, err := CoreReader(zipPath)
	if err != nil {
		t.Fatalf("CoreReader: %v", err)
	}
	defer reader.Close()

	// Drain all records
	for {
		_, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}

	// Next call should also be EOF
	_, err = reader.Read()
	if err != io.EOF {
		t.Errorf("expected EOF after drain, got %v", err)
	}
}
