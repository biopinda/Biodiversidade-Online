package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"biodiversidade-online/internal/config"
	"biodiversidade-online/internal/ingest"
	"biodiversidade-online/internal/mongostore"
	"biodiversidade-online/internal/verbose"
	"biodiversidade-online/internal/version"
)

type sourceResult struct {
	src ingest.IPTSource
	run mongostore.RunRecord
	err error
}

func main() {
	os.Exit(run())
}

func run() int {
	var (
		dryRun   = flag.Bool("dry-run", false, "parse e valida sem gravar no MongoDB")
		cfgPath  = flag.String("config", ".env", "caminho para o arquivo .env")
		logLevel = flag.String("log-level", "", "nível de log: debug, info, warn, error")
		ver      = flag.Bool("version", false, "imprime versão e sai")
	)
	flag.Parse()

	if *ver {
		fmt.Println(version.String())
		return 0
	}

	level := *logLevel
	if level == "" {
		level = "info"
	}
	log := verbose.New(level, "text")

	cfg, err := config.Load(*cfgPath, "occurrences", *dryRun)
	if err != nil {
		log.Error("erro de configuracao", "err", err)
		return 2
	}

	if *logLevel != "" {
		cfg.LogLevel = *logLevel
	}
	log = verbose.New(cfg.LogLevel, cfg.LogFormat)

	log.Info("iniciando script", "binary", "update-occurrences", "version", version.String())

	ctx, cancel := verbose.WithCancellation(context.Background(), log)
	defer cancel()

	sources, err := ingest.LoadIPTSources(cfg.IPTOccurrencesCSV)
	if err != nil {
		log.Error("falha ao carregar CSV de fontes IPT", "path", cfg.IPTOccurrencesCSV, "err", err)
		return 2
	}
	log.Info("fontes IPT carregadas", "count", len(sources), "csv", cfg.IPTOccurrencesCSV)

	var store *mongostore.Store
	if !*dryRun {
		s, err := mongostore.Connect(ctx, cfg.MongoURI, cfg.MongoDatabase)
		if err != nil {
			log.Error("falha ao conectar ao MongoDB", "err", err)
			return 5
		}
		defer s.Close(ctx)
		store = s
		log.Info("conectado ao MongoDB", "database", cfg.MongoDatabase)
	}

	started := time.Now()
	results := make([]sourceResult, 0, len(sources))
	exitCode := 0

	for i, src := range sources {
		if ctx.Err() != nil {
			log.Warn("interrupcao detectada, parando processamento")
			exitCode = 130
			break
		}

		log.Info("processando fonte",
			"index", i+1,
			"total", len(sources),
			"source", src.Tag,
			"nome", src.Nome,
		)

		rc := ingest.RunConfig{
			Cfg:            cfg,
			Source:         ingest.SourceOccurrences,
			SourceID:       src.Tag,
			IPTURLOverride: src.DwCAURL(),
			DryRun:         *dryRun,
			Log:            log,
			Store:          store,
			Binary:         "update-occurrences",
			Version:        version.String(),
		}

		runRecord, runErr := ingest.Run(ctx, rc)

		if store != nil && runRecord.ID != "" {
			if werr := store.WriteRun(context.Background(), runRecord); werr != nil {
				log.Error("falha ao gravar ingest_runs", "source", src.Tag, "err", werr)
			}
		}

		results = append(results, sourceResult{src: src, run: runRecord, err: runErr})

		if runErr != nil {
			if ctx.Err() != nil {
				exitCode = 130
				break
			}
			log.Error("fonte falhou, continuando para proxima", "source", src.Tag, "err", runErr)
			if code := exitCodeFromErr(runErr); code > exitCode {
				exitCode = code
			}
		}
	}

	printReport(results, started)

	return exitCode
}

func printReport(results []sourceResult, started time.Time) {
	var nSuccess, nSkipped, nError int
	for _, r := range results {
		switch {
		case r.run.Status == "skipped":
			nSkipped++
		case r.err != nil:
			nError++
		default:
			nSuccess++
		}
	}

	elapsed := time.Since(started).Round(time.Second)

	fmt.Printf("\n## Relatório — update-occurrences\n")
	fmt.Printf("Data: %s | Fontes: %d | Sucesso: %d | Ignoradas: %d | Erros: %d | Duração: %s\n\n",
		started.Format("2006-01-02 15:04:05"),
		len(results), nSuccess, nSkipped, nError, elapsed,
	)

	fmt.Println("| # | Fonte | Status | Lidos | Inseridos | Atualizados | Removidos | Erro |")
	fmt.Println("|---|-------|--------|-------|-----------|-------------|-----------|------|")

	for i, r := range results {
		link := fmt.Sprintf("[%s](%s)", r.src.Nome, r.src.ResourceURL())

		var status, lidos, inserted, updated, removed, errMsg string

		switch {
		case r.run.Status == "skipped":
			status = "ignorada"
			lidos, inserted, updated, removed = "—", "—", "—", "—"
		case r.err != nil:
			status = "erro"
			lidos, inserted, updated, removed = "—", "—", "—", "—"
			errMsg = truncate(strings.ReplaceAll(r.err.Error(), "\n", " "), 80)
		default:
			status = "sucesso"
			lidos = fmt.Sprintf("%d", r.run.Counters.RecordsRead)
			inserted = fmt.Sprintf("%d", r.run.Counters.RecordsInserted)
			updated = fmt.Sprintf("%d", r.run.Counters.RecordsUpdated)
			removed = fmt.Sprintf("%d", r.run.Counters.RecordsRemoved)
		}

		fmt.Printf("| %d | %s | %s | %s | %s | %s | %s | %s |\n",
			i+1, link, status, lidos, inserted, updated, removed, errMsg)
	}

	fmt.Println()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

func exitCodeFromErr(err error) int {
	if err == nil {
		return 0
	}
	switch err.(type) {
	case *config.ConfigError:
		return 2
	}
	msg := err.Error()
	switch {
	case contains(msg, "download", "network", "timeout", "dial"):
		return 3
	case contains(msg, "archive", "meta.xml", "zip"):
		return 4
	case contains(msg, "mongo", "auth", "write concern"):
		return 5
	}
	return 1
}

func contains(s string, keywords ...string) bool {
	for _, k := range keywords {
		if len(s) >= len(k) {
			for i := 0; i <= len(s)-len(k); i++ {
				if s[i:i+len(k)] == k {
					return true
				}
			}
		}
	}
	return false
}
