package config

import (
	"os"
	"path/filepath"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DBPath         string
	IPTSourcesCSV  string
	BulkBatchSize  int
	LogLevel       string
	LogFormat      string
	HTTPTimeoutMin int
	CacheDir       string
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

func Load(path string, dryRun bool) (*Config, error) {
	_ = godotenv.Load(resolveEnvPath(path))

	cfg := &Config{
		DBPath:        resolveDataPath(envOr("DB_PATH", "./biodiversidade.duckdb")),
		IPTSourcesCSV: resolveDataPath(envOr("IPT_SOURCES_CSV", "./ipt_sources.csv")),
		LogLevel:      envOr("LOG_LEVEL", "info"),
		LogFormat:     envOr("LOG_FORMAT", "text"),
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

	// dry-run mirrors the old MONGO_URI skip: no DB connection is opened, so
	// DB_PATH is not required to resolve to an existing file.
	if !dryRun && cfg.DBPath == "" {
		return nil, &ConfigError{Msg: "required environment variable not set: DB_PATH"}
	}

	return cfg, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
