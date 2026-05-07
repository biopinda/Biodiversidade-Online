package ingest

import (
	"encoding/csv"
	"fmt"
	"os"
	"strings"
)

type IPTSource struct {
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

func LoadIPTSources(csvPath string) ([]IPTSource, error) {
	f, err := os.Open(csvPath)
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

	required := []string{"nome", "repositorio", "kingdom", "tag", "url"}
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
			Nome:        strings.TrimSpace(row[idx["nome"]]),
			Repositorio: strings.TrimSpace(row[idx["repositorio"]]),
			Kingdom:     strings.TrimSpace(row[idx["kingdom"]]),
			Tag:         strings.TrimSpace(row[idx["tag"]]),
			BaseURL:     strings.TrimSpace(row[idx["url"]]),
		}

		if src.Tag == "" || src.BaseURL == "" {
			continue
		}

		sources = append(sources, src)
	}

	if len(sources) == 0 {
		return nil, fmt.Errorf("CSV %q contains no valid sources", csvPath)
	}

	return sources, nil
}
