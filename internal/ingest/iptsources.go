package ingest

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type IPTSource struct {
	Tipo        string
	Nome        string
	Repositorio string
	Kingdom     string
	Tag         string
	BaseURL     string
}

// DwCAURL returns the full DwC-A archive download URL for this source.
func (s IPTSource) DwCAURL() string {
	base := s.BaseURL
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	return base + "archive.do?r=" + s.Tag
}

// ResourceURL returns the IPT resource page URL for this source.
func (s IPTSource) ResourceURL() string {
	base := s.BaseURL
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	return base + "resource?r=" + s.Tag
}

func LoadIPTSources(csvPath string) ([]IPTSource, error) {
	csvPath = filepath.Clean(csvPath)
	f, err := os.Open(csvPath) // #nosec G304 -- path from operator .env config, not end-user input
	if err != nil {
		return nil, fmt.Errorf("open IPT sources CSV %q: %w", csvPath, err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.TrimLeadingSpace = true

	headers, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("read CSV header: %w", err)
	}

	idx := make(map[string]int)
	for i, h := range headers {
		idx[strings.ToLower(strings.TrimSpace(h))] = i
	}

	required := []string{"tipo", "nome", "repositorio", "kingdom", "tag", "url"}
	for _, col := range required {
		if _, ok := idx[col]; !ok {
			return nil, fmt.Errorf("CSV missing required column %q", col)
		}
	}

	var sources []IPTSource
	for {
		row, err := r.Read()
		if err != nil {
			break
		}
		if len(row) == 0 {
			continue
		}

		src := IPTSource{
			Tipo:        strings.TrimSpace(row[idx["tipo"]]),
			Nome:        strings.TrimSpace(row[idx["nome"]]),
			Repositorio: strings.TrimSpace(row[idx["repositorio"]]),
			Kingdom:     strings.TrimSpace(row[idx["kingdom"]]),
			Tag:         strings.TrimSpace(row[idx["tag"]]),
			BaseURL:     strings.TrimSpace(row[idx["url"]]),
		}

		if src.Tipo == "" || src.Tag == "" || src.BaseURL == "" {
			continue
		}

		sources = append(sources, src)
	}

	if len(sources) == 0 {
		return nil, fmt.Errorf("CSV %q contains no valid sources", csvPath)
	}

	return sources, nil
}

// WriteIPTSources overwrites csvPath with sources, in order, using the same
// column layout LoadIPTSources reads.
func WriteIPTSources(csvPath string, sources []IPTSource) error {
	f, err := os.Create(csvPath) // #nosec G304 -- path from operator .env config, not end-user input
	if err != nil {
		return fmt.Errorf("create IPT sources CSV %q: %w", csvPath, err)
	}
	defer f.Close()

	w := csv.NewWriter(f)
	if err := w.Write([]string{"tipo", "nome", "repositorio", "kingdom", "tag", "url"}); err != nil {
		return fmt.Errorf("write CSV header: %w", err)
	}
	for _, s := range sources {
		if err := w.Write([]string{s.Tipo, s.Nome, s.Repositorio, s.Kingdom, s.Tag, s.BaseURL}); err != nil {
			return fmt.Errorf("write source %q: %w", s.Tag, err)
		}
	}
	w.Flush()
	return w.Error()
}
