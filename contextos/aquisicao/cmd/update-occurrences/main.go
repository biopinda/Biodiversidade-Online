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

	// Default to warn — progress bars replace INFO output.
	// Override via --log-level flag or LOG_LEVEL env var.
	level := "warn"
	log := verbose.New(level, "text")

	cfg, err := config.Load(*cfgPath, "occurrences", *dryRun)
	if err != nil {
		log.Error("erro de configuracao", "err", err)
		return 2
	}

	if *logLevel != "" {
		level = *logLevel
	} else if v := os.Getenv("LOG_LEVEL"); v != "" {
		level = cfg.LogLevel
	}
	log = verbose.New(level, cfg.LogFormat)

	fmt.Printf("update-occurrences %s\n\n", version.String())

	ctx, cancel := verbose.WithCancellation(context.Background(), log)
	defer cancel()

	sources, err := ingest.LoadIPTSources(cfg.IPTOccurrencesCSV)
	if err != nil {
		log.Error("falha ao carregar CSV de fontes IPT", "path", cfg.IPTOccurrencesCSV, "err", err)
		return 2
	}
	fmt.Printf("Fontes IPT: %d  |  CSV: %s\n", len(sources), cfg.IPTOccurrencesCSV)

	var store *mongostore.Store
	if !*dryRun {
		s, err := mongostore.Connect(ctx, cfg.MongoURI, cfg.MongoDatabase)
		if err != nil {
			log.Error("falha ao conectar ao MongoDB", "err", err)
			return 5
		}
		defer s.Close(ctx)
		store = s
		fmt.Printf("MongoDB: %s\n", cfg.MongoDatabase)
	} else {
		fmt.Println("Modo: dry-run (sem gravacao no MongoDB)")
	}
	fmt.Println()

	started := time.Now()
	results := make([]sourceResult, 0, len(sources))
	exitCode := 0
	totalSrcs := len(sources)

	for i, src := range sources {
		if ctx.Err() != nil {
			clearStatus()
			exitCode = 130
			break
		}

		idx := i + 1
		prefix := fmt.Sprintf("[%3d/%d]", idx, totalSrcs)

		setStatus(fmt.Sprintf("%s  Baixando: %s [%s]", prefix, trunc(src.Nome, 52), src.Repositorio))

		var (
			srcTotal   int64
			procStart  time.Time
			lastRender time.Time
		)

		progressFn := func(read, total int64) {
			srcTotal = total
			if read == 0 {
				procStart = time.Now()
				lastRender = time.Time{}
				setStatus(fmt.Sprintf("%s  %s [%s]  |  %s registros",
					prefix, trunc(src.Nome, 42), src.Repositorio, fmtN(total)))
				return
			}
			now := time.Now()
			if now.Sub(lastRender) < 100*time.Millisecond {
				return
			}
			lastRender = now
			elapsed := now.Sub(procStart).Seconds()
			rate := int64(0)
			if elapsed > 0 {
				rate = int64(float64(read) / elapsed)
			}
			bar := progBar(read, srcTotal, 22)
			setStatus(fmt.Sprintf("%s  %s  %s/%s (%s%%)  |  %s/s",
				prefix, bar, fmtN(read), fmtN(srcTotal), fmtPct(read, srcTotal), fmtN(rate)))
		}

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
			ProgressFn:     progressFn,
			SilentPipeline: true,
		}

		runRecord, runErr := ingest.Run(ctx, rc)

		if store != nil && runRecord.ID != "" {
			if werr := store.WriteRun(context.Background(), runRecord); werr != nil {
				log.Error("falha ao gravar ingest_runs", "source", src.Tag, "err", werr)
			}
		}

		results = append(results, sourceResult{src: src, run: runRecord, err: runErr})

		clearStatus()

		name := trunc(src.Nome, 48)
		repo := src.Repositorio

		switch {
		case runRecord.Status == "skipped":
			fmt.Printf("%s  ->  %s [%s]  IGNORADO (versao identica no MongoDB)\n",
				prefix, name, repo)
		case runErr != nil:
			fmt.Printf("%s  !!  %s [%s]  ERRO: %s\n",
				prefix, name, repo, trunc(runErr.Error(), 60))
			if ctx.Err() != nil {
				exitCode = 130
			} else if code := exitCodeFromErr(runErr); code > exitCode {
				exitCode = code
			}
		default:
			c := runRecord.Counters
			dur := runRecord.FinishedAt.Sub(runRecord.StartedAt).Round(time.Second)
			_ = srcTotal
			fmt.Printf("%s  OK  %s [%s]  |  %s lidos | %s ins | %s upd | %s rem | %s\n",
				prefix, name, repo,
				fmtN(c.RecordsRead), fmtN(c.RecordsInserted), fmtN(c.RecordsUpdated),
				fmtN(c.RecordsRemoved), dur)
		}

		if exitCode == 130 {
			break
		}
	}

	fmt.Println()
	printReport(results, started)

	return exitCode
}

// --- progress display ---

var statusLen int

func setStatus(s string) {
	pad := statusLen - len(s)
	if pad > 0 {
		s += strings.Repeat(" ", pad)
	}
	statusLen = len(s)
	fmt.Printf("\r%s", s)
}

func clearStatus() {
	if statusLen > 0 {
		fmt.Printf("\r%s\r", strings.Repeat(" ", statusLen))
		statusLen = 0
	}
}

func progBar(done, total int64, width int) string {
	if total <= 0 {
		return "[" + strings.Repeat("-", width) + "]"
	}
	filled := int(float64(done) / float64(total) * float64(width))
	if filled > width {
		filled = width
	}
	return "[" + strings.Repeat("=", filled) + strings.Repeat(" ", width-filled) + "]"
}

func fmtN(n int64) string {
	orig := fmt.Sprintf("%d", n)
	out := make([]byte, 0, len(orig)+len(orig)/3)
	for i := 0; i < len(orig); i++ {
		pos := len(orig) - i
		if pos%3 == 0 && i > 0 {
			out = append(out, '.')
		}
		out = append(out, orig[i])
	}
	return string(out)
}

func fmtPct(done, total int64) string {
	if total == 0 {
		return "??"
	}
	return fmt.Sprintf("%.1f", float64(done)/float64(total)*100)
}

func trunc(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "~"
}

// --- final report ---

func printReport(results []sourceResult, started time.Time) {
	var nSuccess, nSkipped, nError int
	var totalRead, totalIns, totalUpd, totalRem, totalRej int64
	for _, r := range results {
		switch {
		case r.run.Status == "skipped":
			nSkipped++
		case r.err != nil:
			nError++
		default:
			nSuccess++
		}
		totalRead += r.run.Counters.RecordsRead
		totalIns += r.run.Counters.RecordsInserted
		totalUpd += r.run.Counters.RecordsUpdated
		totalRem += r.run.Counters.RecordsRemoved
		totalRej += r.run.Counters.RecordsRejected
	}

	elapsed := time.Since(started).Round(time.Second)

	sep := strings.Repeat("=", 72)
	fmt.Printf("\n%s\n", sep)
	fmt.Printf("RELATORIO FINAL — update-occurrences %s\n", version.String())
	fmt.Printf("%s\n\n", sep)

	fmt.Printf("Data inicio : %s\n", started.Format("2006-01-02 15:04:05"))
	fmt.Printf("Duracao     : %s\n", elapsed)
	fmt.Printf("Fontes      : %d  (sucesso: %d | ignoradas: %d | erros: %d)\n",
		len(results), nSuccess, nSkipped, nError)
	fmt.Printf("Registros   : %s lidos | %s inseridos | %s atualizados | %s removidos | %s rejeitados\n\n",
		fmtN(totalRead), fmtN(totalIns), fmtN(totalUpd), fmtN(totalRem), fmtN(totalRej))

	fmt.Println("| # | Fonte | IPT | Status | Lidos | Inseridos | Atualizados | Removidos | Rejeitados | Erro |")
	fmt.Println("|---|-------|-----|--------|-------|-----------|-------------|-----------|------------|------|")

	for i, r := range results {
		link := fmt.Sprintf("[%s](%s)", r.src.Nome, r.src.ResourceURL())
		repo := r.src.Repositorio

		var status, lidos, inserted, updated, removed, rejected, errMsg string

		switch {
		case r.run.Status == "skipped":
			status = "ignorada"
			lidos, inserted, updated, removed, rejected = "—", "—", "—", "—", "—"
		case r.err != nil:
			status = "erro"
			c := r.run.Counters
			if c.RecordsRead > 0 {
				lidos = fmt.Sprintf("%d", c.RecordsRead)
				inserted = fmt.Sprintf("%d", c.RecordsInserted)
				updated = fmt.Sprintf("%d", c.RecordsUpdated)
				removed = fmt.Sprintf("%d", c.RecordsRemoved)
				rejected = fmt.Sprintf("%d", c.RecordsRejected)
			} else {
				lidos, inserted, updated, removed, rejected = "—", "—", "—", "—", "—"
			}
			errMsg = truncErr(strings.ReplaceAll(r.err.Error(), "\n", " "), 80)
		default:
			status = "sucesso"
			c := r.run.Counters
			lidos = fmt.Sprintf("%d", c.RecordsRead)
			inserted = fmt.Sprintf("%d", c.RecordsInserted)
			updated = fmt.Sprintf("%d", c.RecordsUpdated)
			removed = fmt.Sprintf("%d", c.RecordsRemoved)
			rejected = fmt.Sprintf("%d", c.RecordsRejected)
		}

		fmt.Printf("| %d | %s | %s | %s | %s | %s | %s | %s | %s | %s |\n",
			i+1, link, repo, status, lidos, inserted, updated, removed, rejected, errMsg)
	}

	fmt.Printf("\n%s\n", sep)
}

func truncErr(s string, n int) string {
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
