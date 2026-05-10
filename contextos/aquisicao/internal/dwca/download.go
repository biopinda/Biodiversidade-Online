package dwca

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func Download(ctx context.Context, rawURL, cacheDir string, timeoutMin int) (string, error) {
	if _, err := url.Parse(rawURL); err != nil {
		return "", fmt.Errorf("invalid URL %q: %w", rawURL, err)
	}

	source := sourceFromURL(rawURL)
	destPath := filepath.Join(cacheDir, source+".zip")

	if err := os.MkdirAll(cacheDir, 0750); err != nil {
		return "", fmt.Errorf("create cache dir: %w", err)
	}

	client := &http.Client{Timeout: time.Duration(timeoutMin) * time.Minute}

	var lastErr error
	backoff := []time.Duration{1 * time.Second, 4 * time.Second, 16 * time.Second}

	for attempt := 0; attempt <= len(backoff); attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(backoff[attempt-1]):
			}
		}

		lastErr = tryDownload(ctx, client, rawURL, destPath)
		if lastErr == nil {
			return destPath, nil
		}

		if !isRetryable(lastErr) {
			break
		}
	}

	return "", fmt.Errorf("download failed after retries: %w", lastErr)
}

func tryDownload(ctx context.Context, client *http.Client, rawURL, destPath string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("server error: %s", resp.Status)
	}
	if resp.StatusCode != 200 {
		return fmt.Errorf("unexpected status: %s", resp.Status)
	}

	tmp := destPath + ".tmp"
	f, err := os.Create(tmp) // #nosec G304 -- path constructed from sanitized source slug, not end-user input
	if err != nil {
		return fmt.Errorf("create tmp file: %w", err)
	}

	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		os.Remove(tmp)
		return fmt.Errorf("write download: %w", err)
	}

	if err := f.Close(); err != nil {
		os.Remove(tmp)
		return err
	}

	return os.Rename(tmp, destPath)
}

func isRetryable(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "server error") ||
		strings.Contains(msg, "timeout") ||
		strings.Contains(msg, "connection refused") ||
		strings.Contains(msg, "i/o timeout")
}

func sourceFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "archive"
	}
	if r := u.Query().Get("r"); r != "" {
		return sanitize(r)
	}
	base := filepath.Base(u.Path)
	if base != "" && base != "." {
		return sanitize(strings.TrimSuffix(base, filepath.Ext(base)))
	}
	return "archive"
}

func sanitize(s string) string {
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	return b.String()
}
