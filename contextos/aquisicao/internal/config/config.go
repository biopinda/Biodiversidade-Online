package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	MongoURI          string
	MongoDatabase     string
	IPTFaunaURL       string
	IPTFloraURL       string
	IPTOccurrencesCSV string
	BulkBatchSize     int
	LogLevel          string
	LogFormat         string
	HTTPTimeoutMin    int
	CacheDir          string
}

// ConfigError signals exit code 2 (configuration error).
type ConfigError struct {
	Msg string
}

func (e *ConfigError) Error() string { return e.Msg }

// resolveEnvPath finds .env relative to the executable when CWD doesn't have it.
func resolveEnvPath(path string) string {
	if _, err := os.Stat(path); err == nil {
		return path
	}
	execPath, err := os.Executable()
	if err != nil {
		return path
	}
	execPath, _ = filepath.EvalSymlinks(execPath)
	execDir := filepath.Dir(execPath)
	for _, candidate := range []string{
		filepath.Join(execDir, filepath.Base(path)),
		filepath.Join(execDir, "..", filepath.Base(path)),
	} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return path
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

func Load(path, source string, dryRun bool) (*Config, error) {
	_ = godotenv.Load(resolveEnvPath(path))

	cfg := &Config{
		MongoURI:          os.Getenv("MONGO_URI"),
		MongoDatabase:     envOr("MONGO_DATABASE", "dwc2json"),
		IPTFaunaURL:       os.Getenv("IPT_FAUNA_URL"),
		IPTFloraURL:       os.Getenv("IPT_FLORA_URL"),
		IPTOccurrencesCSV: resolveDataPath(envOr("IPT_OCCURRENCES_CSV", "data/occurrences.csv")),
		LogLevel:          envOr("LOG_LEVEL", "info"),
		LogFormat:         envOr("LOG_FORMAT", "text"),
	}

	if v := os.Getenv("BULK_BATCH_SIZE"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 10000 {
			return nil, &ConfigError{Msg: "BULK_BATCH_SIZE must be an integer between 1 and 10000"}
		}
		cfg.BulkBatchSize = n
	} else {
		cfg.BulkBatchSize = 5000
	}

	if v := os.Getenv("HTTP_TIMEOUT_MIN"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			return nil, &ConfigError{Msg: "HTTP_TIMEOUT_MIN must be a positive integer"}
		}
		cfg.HTTPTimeoutMin = n
	} else {
		cfg.HTTPTimeoutMin = 30
	}

	if v := os.Getenv("CACHE_DIR"); v != "" {
		cfg.CacheDir = v
	}

	if !dryRun {
		return cfg, validateForSource(cfg, source)
	}
	return cfg, validateDryRun(cfg, source)
}

func validateForSource(cfg *Config, source string) error {
	var missing []string

	if cfg.MongoURI == "" {
		missing = append(missing, "MONGO_URI")
	}

	switch source {
	case "fauna":
		if cfg.IPTFaunaURL == "" {
			missing = append(missing, "IPT_FAUNA_URL")
		}
	case "flora":
		if cfg.IPTFloraURL == "" {
			missing = append(missing, "IPT_FLORA_URL")
		}
	// occurrences: IPT_OCCURRENCES_CSV tem default, sem validação obrigatória
	}

	if len(missing) > 0 {
		return &ConfigError{
			Msg: fmt.Sprintf("required environment variables not set: %s", strings.Join(missing, ", ")),
		}
	}
	return nil
}

// validateDryRun valida apenas variáveis obrigatórias para dry-run (sem MONGO_URI).
func validateDryRun(cfg *Config, source string) error {
	var missing []string

	switch source {
	case "fauna":
		if cfg.IPTFaunaURL == "" {
			missing = append(missing, "IPT_FAUNA_URL")
		}
	case "flora":
		if cfg.IPTFloraURL == "" {
			missing = append(missing, "IPT_FLORA_URL")
		}
	}

	if len(missing) > 0 {
		return &ConfigError{
			Msg: fmt.Sprintf("required environment variables not set: %s", strings.Join(missing, ", ")),
		}
	}
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
