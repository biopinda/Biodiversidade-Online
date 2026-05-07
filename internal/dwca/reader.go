package dwca

import (
	"archive/zip"
	"encoding/csv"
	"fmt"
	"io"
	"strings"
)

// Record maps DwC term URIs to string values.
type Record map[string]string

type Reader struct {
	zr        *zip.ReadCloser
	rc        io.ReadCloser
	csv       *csv.Reader
	indexTerm map[int]string // column index → DwC term
	idIndex   int
	done      bool
}

func newReader(zr *zip.ReadCloser, f *zip.File, fields []Field, idIndex int, sep string, skipLines int) (*Reader, error) {
	rc, err := f.Open()
	if err != nil {
		zr.Close()
		return nil, fmt.Errorf("open data file: %w", err)
	}

	delimiter := '\t'
	if sep != "" && sep != `\t` {
		runes := []rune(sep)
		if len(runes) > 0 {
			delimiter = runes[0]
		}
	}

	cr := csv.NewReader(rc)
	cr.Comma = delimiter
	cr.LazyQuotes = true
	cr.FieldsPerRecord = -1

	// Skip header lines
	for i := 0; i < skipLines; i++ {
		if _, err := cr.Read(); err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}
	}

	indexTerm := make(map[int]string, len(fields))
	for _, f := range fields {
		// Extract short term name from URI
		term := f.Term
		if idx := strings.LastIndex(term, "/"); idx >= 0 {
			term = term[idx+1:]
		}
		indexTerm[f.Index] = term
	}

	return &Reader{
		zr:        zr,
		rc:        rc,
		csv:       cr,
		indexTerm: indexTerm,
		idIndex:   idIndex,
	}, nil
}

func (r *Reader) Read() (Record, error) {
	if r.done {
		return nil, io.EOF
	}

	row, err := r.csv.Read()
	if err != nil {
		r.done = true
		return nil, err
	}

	rec := make(Record, len(row))
	for i, val := range row {
		if term, ok := r.indexTerm[i]; ok {
			rec[term] = val
		}
	}

	// Ensure ID field is included under "id" key if not already mapped
	if r.idIndex >= 0 && r.idIndex < len(row) {
		if _, hasID := rec["id"]; !hasID {
			if _, hasTerm := r.indexTerm[r.idIndex]; !hasTerm {
				rec["id"] = row[r.idIndex]
			}
		}
	}

	return rec, nil
}

func (r *Reader) Close() error {
	r.rc.Close()
	return r.zr.Close()
}
