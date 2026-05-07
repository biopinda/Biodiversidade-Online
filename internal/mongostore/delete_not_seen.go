package mongostore

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func DeleteNotSeen(ctx context.Context, coll *mongo.Collection, source, runID string) (int64, error) {
	filter := bson.D{
		{Key: "source", Value: source},
		{Key: "_runId", Value: bson.D{{Key: "$ne", Value: runID}}},
	}

	res, err := coll.DeleteMany(ctx, filter)
	if err != nil {
		return 0, err
	}
	return res.DeletedCount, nil
}
