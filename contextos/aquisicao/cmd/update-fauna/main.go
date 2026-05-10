package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"biodiversidade-online/internal/config"
	"biodiversidade-online/internal/ingest"
	"biodiversidade-online/internal/mongostore"
	"biodiversidade-online/internal/verbose"
	"biodiversidade-online/internal/version"
)

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

	fmt.Printf("update-fauna %s  (dry-run=%v  config=%s)\n", version.String(), *dryRun, *cfgPath)

	level := *logLevel
	if level == "" {
		level = "info"
	}
	log := verbose.New(level, "text")

	cfg, err := config.Load(*cfgPath, "fauna", *dryRun)
	if err != nil {
		fmt.Fprintf(os.Stdout, "ERRO configuracao: %v\n", err)
		fmt.Fprintf(os.Stdout, "Dica: rode o binario da raiz do repositorio onde esta o .env\n")
		return 2
	}

	if *logLevel != "" {
		cfg.LogLevel = *logLevel
	}
	log = verbose.New(cfg.LogLevel, cfg.LogFormat)

	log.Info("configuracao carregada", "database", cfg.MongoDatabase, "dry_run", *dryRun)

	ctx, cancel := verbose.WithCancellation(context.Background(), log)
	defer cancel()

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

	rc := ingest.RunConfig{
		Cfg:     cfg,
		Source:  ingest.SourceFauna,
		DryRun:  *dryRun,
		Log:     log,
		Store:   store,
		Binary:  "update-fauna",
		Version: version.String(),
	}

	var runRecord mongostore.RunRecord
	defer func() {
		if store != nil && runRecord.ID != "" {
			if err := store.WriteRun(context.Background(), runRecord); err != nil {
				log.Error("falha ao gravar ingest_runs", "err", err)
			} else {
				log.Info("gravando ingest_runs", "status", runRecord.Status)
			}
		}
	}()

	runRecord, err = ingest.Run(ctx, rc)
	if err != nil {
		if runRecord.Status == "" {
			runRecord.Status = "failed"
		}
		runRecord.ErrorMessage = err.Error()
		log.Error("encerrando", "exit_code", exitCodeFromErr(err), "err", err)
		return exitCodeFromErr(err)
	}

	return 0
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
