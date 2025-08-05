// host/services/capture-daemon/config/config.go
package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Broker   BrokerConfig   `mapstructure:"broker"`
	Capture  CaptureConfig  `mapstructure:"capture"`
	Features FeatureConfig  `mapstructure:"features"`
	Logging  LoggingConfig  `mapstructure:"logging"`
	Health   HealthConfig   `mapstructure:"health"`
}

type ServerConfig struct {
	Host         string        `mapstructure:"host"`
	Port         int           `mapstructure:"port"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
	IdleTimeout  time.Duration `mapstructure:"idle_timeout"`
}

type BrokerConfig struct {
	URL            string        `mapstructure:"url"`
	Exchange       string        `mapstructure:"exchange"`
	ConnectTimeout time.Duration `mapstructure:"connect_timeout"`
	ReconnectDelay time.Duration `mapstructure:"reconnect_delay"`
	MaxRetries     int           `mapstructure:"max_retries"`
}

type CaptureConfig struct {
	OutputDir     string        `mapstructure:"output_dir"`
	PollInterval  time.Duration `mapstructure:"poll_interval"`
	FFmpegPath    string        `mapstructure:"ffmpeg_path"`
	DefaultFPS    int           `mapstructure:"default_fps"`
	DefaultRes    string        `mapstructure:"default_resolution"`
	MaxConcurrent int           `mapstructure:"max_concurrent"`
}

type FeatureConfig struct {
	HLSPreview struct {
		Enabled bool          `mapstructure:"enabled"`
		Dir     string        `mapstructure:"dir"`
		TTL     time.Duration `mapstructure:"ttl"`
	} `mapstructure:"hls_preview"`

	MP4Serve struct {
		Enabled bool   `mapstructure:"enabled"`
		Dir     string `mapstructure:"dir"`
	} `mapstructure:"mp4_serve"`

	Metrics struct {
		Enabled bool   `mapstructure:"enabled"`
		Port    int    `mapstructure:"port"`
		Path    string `mapstructure:"path"`
	} `mapstructure:"metrics"`
}

type LoggingConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
	Output string `mapstructure:"output"`
}

type HealthConfig struct {
	Enabled  bool          `mapstructure:"enabled"`
	Port     int           `mapstructure:"port"`
	Interval time.Duration `mapstructure:"interval"`
}

func Load() (*Config, error) {
	// look for config.{yaml,json,...} in these locations
	viper.SetConfigName("config")
	viper.AddConfigPath("/etc/capture-daemon/")
	viper.AddConfigPath("$HOME/.capture-daemon")
	viper.AddConfigPath(".")

	// ENV support: CAPTURE_<KEY>, with dots → underscores
	viper.SetEnvPrefix("CAPTURE")
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	setDefaults()

	// read file if present
	if err := viper.ReadInConfig(); err != nil {
		// only fail on real errors, not "file not found"
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("reading config: %w", err)
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	return &cfg, nil
}

func setDefaults() {
	// server
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 9000)
	viper.SetDefault("server.read_timeout", "30s")
	viper.SetDefault("server.write_timeout", "30s")
	viper.SetDefault("server.idle_timeout", "120s")

	// broker
	viper.SetDefault("broker.url", "amqp://guest:guest@localhost:5672/")
	viper.SetDefault("broker.exchange", "capture")
	viper.SetDefault("broker.connect_timeout", "10s")
	viper.SetDefault("broker.reconnect_delay", "5s")
	viper.SetDefault("broker.max_retries", 5)

	// capture
	viper.SetDefault("capture.output_dir", "/tmp/recordings")
	viper.SetDefault("capture.poll_interval", "5s")
	viper.SetDefault("capture.ffmpeg_path", "ffmpeg")
	viper.SetDefault("capture.default_fps", 30)
	viper.SetDefault("capture.default_resolution", "1920x1080")
	viper.SetDefault("capture.max_concurrent", 5)

	// features.hls_preview
	viper.SetDefault("features.hls_preview.enabled", false)
	viper.SetDefault("features.hls_preview.dir", "/tmp/hls")
	viper.SetDefault("features.hls_preview.ttl", "1h")

	// features.mp4_serve
	viper.SetDefault("features.mp4_serve.enabled", false)
	viper.SetDefault("features.mp4_serve.dir", "/tmp/recordings")

	// features.metrics
	viper.SetDefault("features.metrics.enabled", true)
	viper.SetDefault("features.metrics.port", 9001)
	viper.SetDefault("features.metrics.path", "/metrics")

	// logging
	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.format", "json")
	viper.SetDefault("logging.output", "stdout")

	// health
	viper.SetDefault("health.enabled", true)
	viper.SetDefault("health.port", 9002)
	viper.SetDefault("health.interval", "30s")
}