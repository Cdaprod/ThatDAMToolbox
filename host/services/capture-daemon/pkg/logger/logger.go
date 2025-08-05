// host/services/capture-daemon/pkg/logger/logger.go
package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

type Logger struct {
	*slog.Logger
}

// New creates a structured logger at the given level/format/output.
// Level: debug|info|warn|error
// Format: json|text
// Output: stdout|stderr|<file path>
func New(level, format, output string) (*Logger, error) {
	// decide output destination
	var w io.Writer
	switch strings.ToLower(output) {
	case "", "stdout":
		w = os.Stdout
	case "stderr":
		w = os.Stderr
	default:
		f, err := os.OpenFile(output, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o666)
		if err != nil {
			return nil, err
		}
		w = f
	}

	// setup handler options
	opts := &slog.HandlerOptions{
		Level: parseLevel(level),
	}

	// choose JSON vs text
	var handler slog.Handler
	if strings.EqualFold(format, "json") {
		handler = slog.NewJSONHandler(w, opts)
	} else {
		handler = slog.NewTextHandler(w, opts)
	}

	base := slog.New(handler)
	return &Logger{Logger: base}, nil
}

func parseLevel(lvl string) slog.Level {
	switch strings.ToLower(lvl) {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// WithContext adds request_id from ctx, if present.
func (l *Logger) WithContext(ctx context.Context) *slog.Logger {
	if reqID := ctx.Value("request_id"); reqID != nil {
		return l.With("request_id", reqID)
	}
	return l.Logger
}

// WithDevice annotates logs with a device_id.
func (l *Logger) WithDevice(id string) *slog.Logger {
	return l.With("device_id", id)
}

// WithComponent annotates logs with a component name.
func (l *Logger) WithComponent(name string) *slog.Logger {
	return l.With("component", name)
}