package duckstore

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/marcboeker/go-duckdb/v2"
)

// Store wraps the single DuckDB write connection for the whole process.
// DuckDB allows only one writer per file, so callers share this instance.
type Store struct {
	DB *sql.DB
}

// Connect opens the DuckDB file at path and ensures the schema exists.
func Connect(path string) (*Store, error) {
	db, err := sql.Open("duckdb", path)
	if err != nil {
		return nil, fmt.Errorf("open duckdb %q: %w", path, err)
	}
	// DuckDB permits a single writer connection per database file.
	db.SetMaxOpenConns(1)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping duckdb %q: %w", path, err)
	}

	if err := createSchema(context.Background(), db); err != nil {
		db.Close()
		return nil, fmt.Errorf("create schema: %w", err)
	}

	return &Store{DB: db}, nil
}

// Close closes the underlying DuckDB connection.
func (s *Store) Close() error {
	return s.DB.Close()
}
