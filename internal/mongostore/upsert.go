package mongostore

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type UpsertResult struct {
	Upserted int64
	Modified int64
}

func BulkUpsert(ctx context.Context, coll *mongo.Collection, docs []bson.M, runID, source string) (UpsertResult, error) {
	if len(docs) == 0 {
		return UpsertResult{}, nil
	}

	now := time.Now().UTC()
	models := make([]mongo.WriteModel, 0, len(docs))

	for _, doc := range docs {
		id, ok := doc["_id"]
		if !ok {
			continue
		}

		doc["_runId"] = runID
		doc["source"] = source
		doc["ingestedAt"] = now

		model := mongo.NewReplaceOneModel().
			SetFilter(bson.D{{Key: "_id", Value: id}}).
			SetReplacement(doc).
			SetUpsert(true)

		models = append(models, model)
	}

	if len(models) == 0 {
		return UpsertResult{}, nil
	}

	opts := options.BulkWrite().SetOrdered(false)
	res, err := coll.BulkWrite(ctx, models, opts)
	if err != nil {
		return UpsertResult{}, err
	}

	return UpsertResult{
		Upserted: res.UpsertedCount,
		Modified: res.ModifiedCount,
	}, nil
}
