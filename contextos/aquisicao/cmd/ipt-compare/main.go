package main

import (
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"biodiversidade-online/internal/ingest"
)

const httpTimeout = 30 * time.Second

type iptInventory struct {
	Resources []iptResource `json:"resources"`
}

type iptResource struct {
	ID       string       `json:"id"`
	Title    string       `json:"title"`
	Format   string       `json:"format"`
	Records  int          `json:"records"`
	Archive  []iptArchive `json:"archive"`
	AddProps struct {
		Core string `json:"core"`
	} `json:"additionalProperties"`
}

type iptArchive struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

func main() {
	os.Exit(run())
}

func run() int {
	var (
		endpoint = flag.String("endpoint", "", "URL do endpoint de inventário do IPT (obrigatório)")
		csvPath  = flag.String("csv", "", "caminho para occurrences.csv (padrão: auto-detectado)")
		add      = flag.Bool("add", false, "adicionar recursos ausentes ao CSV")
		kingdom  = flag.String("kingdom", "", "kingdom a atribuir aos novos recursos (ex: Plantae, Animalia)")
		yes      = flag.Bool("yes", false, "não pedir confirmação ao adicionar (use com --add)")
	)
	flag.Parse()

	if *endpoint == "" {
		fmt.Fprintln(os.Stderr, "erro: --endpoint é obrigatório")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Uso:")
		flag.PrintDefaults()
		return 2
	}

	csvFile := *csvPath
	if csvFile == "" {
		csvFile = resolveDataPath("data/occurrences.csv")
	}

	fmt.Printf("Endpoint : %s\n", *endpoint)
	fmt.Printf("CSV      : %s\n", csvFile)
	fmt.Println()

	resources, baseURL, repo, err := fetchInventory(*endpoint)
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro ao buscar inventário IPT: %v\n", err)
		return 3
	}
	fmt.Printf("IPT base : %s  (repo=%s)\n", baseURL, repo)
	fmt.Printf("Recursos no IPT: %d\n", len(resources))

	existing, err := ingest.LoadIPTSources(csvFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro ao carregar CSV: %v\n", err)
		return 2
	}
	fmt.Printf("Entradas no CSV: %d\n\n", len(existing))

	existingURLs := make(map[string]struct{}, len(existing))
	for _, src := range existing {
		existingURLs[normalizeURL(src.DwCAURL())] = struct{}{}
	}

	var missing []ingest.IPTSource
	skipped := 0
	for _, r := range resources {
		if r.Format != "DWCA" || r.AddProps.Core != "OCCURRENCE" {
			skipped++
			continue
		}
		dwcaURL := archiveURL(r)
		if dwcaURL == "" {
			skipped++
			continue
		}
		if _, found := existingURLs[normalizeURL(dwcaURL)]; found {
			continue
		}
		missing = append(missing, ingest.IPTSource{
			Nome:        r.Title,
			Repositorio: repo,
			Kingdom:     *kingdom,
			Tag:         r.ID,
			BaseURL:     baseURL,
		})
	}

	if skipped > 0 {
		fmt.Printf("Ignorados %d recursos sem formato DWCA/OCCURRENCE.\n\n", skipped)
	}

	if len(missing) == 0 {
		fmt.Println("Nenhum recurso novo encontrado. O CSV já está atualizado.")
		return 0
	}

	fmt.Printf("Recursos ausentes no CSV: %d\n", len(missing))
	fmt.Println(strings.Repeat("-", 70))
	for i, src := range missing {
		fmt.Printf("  [%3d] %s\n        tag: %s\n        url: %s\n", i+1, src.Nome, src.Tag, src.DwCAURL())
	}
	fmt.Println(strings.Repeat("-", 70))
	fmt.Println()

	if !*add {
		fmt.Println("Use --add para adicionar ao CSV (--yes para pular confirmação).")
		return 0
	}

	if !*yes {
		fmt.Printf("Adicionar %d recursos a %s? [s/N] ", len(missing), csvFile)
		var resp string
		fmt.Scanln(&resp)
		if strings.ToLower(strings.TrimSpace(resp)) != "s" {
			fmt.Println("Cancelado.")
			return 0
		}
	}

	backupPath, err := backupCSV(csvFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro ao criar backup: %v\n", err)
		return 1
	}
	fmt.Printf("Backup criado: %s\n", backupPath)

	if err := appendToCSV(csvFile, missing); err != nil {
		fmt.Fprintf(os.Stderr, "erro ao escrever no CSV: %v\n", err)
		return 1
	}

	fmt.Printf("OK: %d recursos adicionados a %s\n", len(missing), csvFile)
	return 0
}

func fetchInventory(endpoint string) ([]iptResource, string, string, error) {
	u, err := url.Parse(endpoint)
	if err != nil {
		return nil, "", "", fmt.Errorf("URL inválida: %w", err)
	}

	parts := strings.SplitN(strings.TrimPrefix(u.Path, "/"), "/", 2)
	basePath := "/"
	repoKey := ""
	if len(parts) >= 1 && parts[0] != "" {
		basePath = "/" + parts[0] + "/"
		repoKey = parts[0]
	}
	if repoKey == "" {
		repoKey = strings.Split(u.Hostname(), ".")[0]
	}
	baseURL := u.Scheme + "://" + u.Host + basePath

	client := &http.Client{Timeout: httpTimeout}
	resp, err := client.Get(endpoint) // #nosec G107 -- operator-supplied URL
	if err != nil {
		return nil, "", "", fmt.Errorf("GET %s: %w", endpoint, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", "", fmt.Errorf("GET %s: status %d", endpoint, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", "", fmt.Errorf("ler resposta: %w", err)
	}

	var inv iptInventory
	if err := json.Unmarshal(body, &inv); err != nil {
		return nil, "", "", fmt.Errorf("parse JSON: %w", err)
	}

	return inv.Resources, baseURL, repoKey, nil
}

func archiveURL(r iptResource) string {
	for _, a := range r.Archive {
		if a.Type == "DWCA" {
			return a.URL
		}
	}
	return ""
}

func normalizeURL(u string) string {
	return strings.TrimRight(strings.ToLower(u), "/")
}

func backupCSV(csvPath string) (string, error) {
	date := time.Now().Format("20060102")
	dir := filepath.Dir(csvPath)
	base := strings.TrimSuffix(filepath.Base(csvPath), filepath.Ext(csvPath))
	backupPath := filepath.Join(dir, fmt.Sprintf("%s_backup_%s.csv", base, date))

	src, err := os.Open(csvPath) // #nosec G304 -- operator-supplied path
	if err != nil {
		return "", err
	}
	defer src.Close()

	dst, err := os.Create(backupPath) // #nosec G304
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return "", err
	}
	return backupPath, nil
}

func appendToCSV(csvPath string, sources []ingest.IPTSource) error {
	f, err := os.OpenFile(csvPath, os.O_APPEND|os.O_WRONLY, 0o644) // #nosec G304
	if err != nil {
		return err
	}
	defer f.Close()

	w := csv.NewWriter(f)
	for _, src := range sources {
		if err := w.Write([]string{src.Nome, src.Repositorio, src.Kingdom, src.Tag, src.BaseURL}); err != nil {
			return err
		}
	}
	w.Flush()
	return w.Error()
}

// resolveDataPath finds data files relative to the executable when CWD doesn't have them.
func resolveDataPath(rel string) string {
	if _, err := os.Stat(rel); err == nil {
		return rel
	}
	execPath, err := os.Executable()
	if err != nil {
		return rel
	}
	execPath, _ = filepath.EvalSymlinks(execPath)
	execDir := filepath.Dir(execPath)
	for _, candidate := range []string{
		filepath.Join(execDir, rel),
		filepath.Join(execDir, "..", rel),
	} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return rel
}
