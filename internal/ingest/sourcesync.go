package ingest

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// inventoryTimeout bounds a single IPT inventory request. No retry: this is
// a manual, on-demand sync (not the ingestion path), so re-running is cheap.
const inventoryTimeout = 15 * time.Second

// inventoryResource is one OCCURRENCE-core resource from an IPT's inventory.
type inventoryResource struct {
	ID    string
	Title string
}

// HostSyncResult reports the outcome of syncing ipt_sources.csv rows for one
// IPT host. Err set means the host was unreachable or returned an error: its
// existing rows are left completely untouched (never removed on a fetch
// failure — a down host is not the same as "resources were unpublished").
type HostSyncResult struct {
	BaseURL   string
	Added     int
	Removed   int
	Unchanged int
	Err       error
}

// SyncOutcome is the result of SyncSources: the full resulting source list
// (existing rows preserved in place, minus removed, plus new ones appended)
// and a per-host report.
type SyncOutcome struct {
	Sources []IPTSource
	Hosts   []HostSyncResult
}

// SyncSources refreshes the `ocorrencias` rows of sources against each
// distinct IPT host's inventory (core=OCCURRENCE only). `taxa` rows, and any
// row at a host that failed to respond, are left untouched. Existing rows
// keep their curated Nome/Kingdom/Repositorio; only new rows get defaults
// derived from the API. New rows are appended at the end of the returned
// slice; removed rows simply drop out. Row order is otherwise preserved.
func SyncSources(ctx context.Context, sources []IPTSource) SyncOutcome {
	var hosts []string
	seenHost := make(map[string]bool)
	for _, s := range sources {
		if !seenHost[s.BaseURL] {
			seenHost[s.BaseURL] = true
			hosts = append(hosts, s.BaseURL)
		}
	}

	client := &http.Client{Timeout: inventoryTimeout}

	keep := make([]bool, len(sources))
	for i := range keep {
		keep[i] = true
	}

	var toAppend []IPTSource
	var results []HostSyncResult

	for _, host := range hosts {
		resources, err := fetchOccurrenceInventory(ctx, client, host)
		if err != nil {
			results = append(results, HostSyncResult{BaseURL: host, Err: err})
			continue
		}

		apiTags := make(map[string]bool, len(resources))
		for _, r := range resources {
			apiTags[r.ID] = true
		}

		var added, removed, unchanged int
		seenTag := make(map[string]bool, len(resources))

		for i, s := range sources {
			if s.BaseURL != host || s.Tipo != "ocorrencias" {
				continue
			}
			if apiTags[s.Tag] {
				seenTag[s.Tag] = true
				unchanged++
				continue
			}
			keep[i] = false
			removed++
		}

		for _, r := range resources {
			if seenTag[r.ID] {
				continue
			}
			toAppend = append(toAppend, IPTSource{
				Tipo:        "ocorrencias",
				Nome:        r.Title,
				Repositorio: repositorioFromURL(host),
				Tag:         r.ID,
				BaseURL:     host,
			})
			added++
		}

		results = append(results, HostSyncResult{BaseURL: host, Added: added, Removed: removed, Unchanged: unchanged})
	}

	final := make([]IPTSource, 0, len(sources)+len(toAppend))
	for i, s := range sources {
		if keep[i] {
			final = append(final, s)
		}
	}
	final = append(final, toAppend...)

	return SyncOutcome{Sources: final, Hosts: results}
}

// fetchOccurrenceInventory fetches an IPT's inventory and returns only its
// core=OCCURRENCE resources.
func fetchOccurrenceInventory(ctx context.Context, client *http.Client, baseURL string) ([]inventoryResource, error) {
	base := baseURL
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"inventory/v2/dataset?type=dwca", nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %s", resp.Status)
	}

	var payload struct {
		Resources []struct {
			ID                   string `json:"id"`
			Title                string `json:"title"`
			AdditionalProperties struct {
				Core string `json:"core"`
			} `json:"additionalProperties"`
		} `json:"resources"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode inventory: %w", err)
	}

	var out []inventoryResource
	for _, r := range payload.Resources {
		if r.AdditionalProperties.Core != "OCCURRENCE" {
			continue
		}
		out = append(out, inventoryResource{ID: r.ID, Title: r.Title})
	}
	return out, nil
}

// repositorioFromURL derives a default Repositorio for a newly discovered
// source: the IPT base URL's last path segment (e.g. "https://host/inpa/" ->
// "inpa"). Curated exceptions (e.g. "goeldi" -> "mpeg") are left for manual
// edit after the sync.
func repositorioFromURL(baseURL string) string {
	u, err := url.Parse(baseURL)
	if err != nil {
		return ""
	}
	trimmed := strings.Trim(u.Path, "/")
	if trimmed == "" {
		return ""
	}
	segs := strings.Split(trimmed, "/")
	return segs[len(segs)-1]
}
