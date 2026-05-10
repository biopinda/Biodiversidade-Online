package mongostore

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Store struct {
	client      *mongo.Client
	Taxa        *mongo.Collection
	Occurrences *mongo.Collection
	IngestRuns  *mongo.Collection
}

func Connect(ctx context.Context, uri, dbName string) (*Store, error) {
	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	db := client.Database(dbName)
	return &Store{
		client:      client,
		Taxa:        db.Collection("taxa"),
		Occurrences: db.Collection("occurrences"),
		IngestRuns:  db.Collection("ingest_runs"),
	}, nil
}

func (s *Store) Close(ctx context.Context) error {
	return s.client.Disconnect(ctx)
}
