package mongostore

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type RunRecord struct {
	ID           string    `bson:"_id"`
	Source       string    `bson:"source"`
	Binary       string    `bson:"binary"`
	Version      string    `bson:"version"`
	StartedAt    time.Time `bson:"startedAt"`
	FinishedAt   time.Time `bson:"finishedAt,omitempty"`
	DurationSec  float64   `bson:"durationSec,omitempty"`
	Status       string    `bson:"status"`
	ExitCode     int       `bson:"exitCode"`
	ErrorMessage string    `bson:"errorMessage,omitempty"`
	DryRun       bool      `bson:"dryRun,omitempty"`
	DwCA         DwCAInfo  `bson:"dwca"`
	Counters     Counters  `bson:"counters"`
	Warnings     []string  `bson:"warnings,omitempty"`
}

type DwCAInfo struct {
	URL             string `bson:"url"`
	DownloadedBytes int64  `bson:"downloadedBytes,omitempty"`
	PubDate         string `bson:"pubDate,omitempty"`
	Version         string `bson:"version,omitempty"`
	Title           string `bson:"title,omitempty"`
}

type Counters struct {
	RecordsRead                   int64 `bson:"recordsRead"`
	RecordsRejected               int64 `bson:"recordsRejected"`
	RecordsUpserted               int64 `bson:"recordsUpserted"`
	RecordsRemoved                int64 `bson:"recordsRemoved"`
	RecordsWithSuspectCoordinates int64 `bson:"recordsWithSuspectCoordinates,omitempty"`
}

func (s *Store) WriteRun(ctx context.Context, run RunRecord) error {
	_, err := s.IngestRuns.InsertOne(ctx, run)
	return err
}

func (s *Store) LastSuccessfulRun(ctx context.Context, source string) (*RunRecord, error) {
	filter := bson.D{
		{Key: "source", Value: source},
		{Key: "status", Value: "success"},
	}

	opts := options.FindOne().SetSort(bson.D{{Key: "startedAt", Value: -1}})

	var run RunRecord
	if err := s.IngestRuns.FindOne(ctx, filter, opts).Decode(&run); err != nil {
		return nil, err
	}
	return &run, nil
}
