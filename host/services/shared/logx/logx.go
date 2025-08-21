package logx

import (
	"context"
	"fmt"
	"io"
	stdlog "log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/log"
	"github.com/muesli/termenv"
	"golang.org/x/term"
)

type Config struct {
	Service string
	Version string
	Level   string // debug|info|warn|error
	Format  string // auto|text|json
	Caller  string // off|short|full
	Time    string // off|rfc3339|rfc3339ms
	NoColor bool
	Writer  io.Writer
}

var L *log.Logger

func Init(cfg Config) {
	w := cfg.Writer
	if w == nil {
		w = os.Stdout
	}

	format := cfg.Format
	if format == "" || strings.EqualFold(format, "auto") {
		if term.IsTerminal(int(os.Stdout.Fd())) {
			format = "text"
		} else {
			format = "json"
		}
	}

	opts := log.Options{
		Level:        parseLevel(cfg.Level),
		ReportCaller: cfg.Caller != "" && cfg.Caller != "off",
		TimeFormat:   pickTime(cfg.Time),
	}
	L = log.NewWithOptions(w, opts)
	if strings.EqualFold(format, "json") {
		L.SetFormatter(log.JSONFormatter)
	}
	if cfg.NoColor {
		L.SetColorProfile(termenv.Ascii)
	}

	host := hostname()
	L = L.With(
		"svc", cfg.Service,
		"version", cfg.Version,
		"instance", host,
		"pid", os.Getpid(),
	)

	stdlog.SetFlags(0)
	stdlog.SetOutput(L.StandardLog(log.StandardLogOptions{ForceLevel: log.InfoLevel}).Writer())

	if cfg.Caller == "short" {
		L.SetCallerFormatter(func(f string, line int, fn string) string { return shortFile(f, line) })
	}
}

func With(kv ...any) *log.Logger { return L.With(kv...) }

type ctxKey struct{}

// ToContext returns a new context carrying l.
func ToContext(ctx context.Context, l *log.Logger) context.Context {
	return context.WithValue(ctx, ctxKey{}, l)
}

// FromContext retrieves a logger from ctx or returns the global logger.
func FromContext(ctx context.Context) *log.Logger {
	if v, ok := ctx.Value(ctxKey{}).(*log.Logger); ok && v != nil {
		return v
	}
	return L
}

func parseLevel(lvl string) log.Level {
	switch strings.ToLower(lvl) {
	case "debug":
		return log.DebugLevel
	case "warn", "warning":
		return log.WarnLevel
	case "error":
		return log.ErrorLevel
	default:
		return log.InfoLevel
	}
}

func pickTime(t string) string {
	switch strings.ToLower(t) {
	case "off":
		return ""
	case "rfc3339":
		return time.RFC3339
	case "", "rfc3339ms":
		return "2006-01-02T15:04:05.000Z07:00"
	default:
		return t
	}
}

func hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}

func shortFile(f string, line int) string {
	return fmt.Sprintf("%s:%d", filepath.Base(f), line)
}
