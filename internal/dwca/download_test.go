package dwca

import (
	"errors"
	"fmt"
	"testing"
)

func TestIsRetryable(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"dns lookup failure", errors.New(`dial tcp: lookup ipt.jbrj.gov.br: no such host`), true},
		{"server error", fmt.Errorf("server error: %s", "503 Service Unavailable"), true},
		{"connection refused", errors.New("dial tcp: connection refused"), true},
		{"timeout", errors.New("context deadline exceeded (timeout)"), true},
		{"unexpected status", errors.New("unexpected status: 404 Not Found"), false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isRetryable(tc.err); got != tc.want {
				t.Errorf("isRetryable(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}
