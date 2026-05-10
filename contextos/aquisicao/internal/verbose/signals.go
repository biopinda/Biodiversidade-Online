package verbose

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
)

func WithCancellation(ctx context.Context, log *slog.Logger) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(ctx)

	go func() {
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, os.Interrupt, syscall.SIGTERM)
		select {
		case <-ch:
			log.Warn("interrupcao recebida")
			cancel()
		case <-ctx.Done():
		}
	}()

	return ctx, cancel
}
