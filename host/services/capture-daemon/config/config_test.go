package config

import "testing"

// TestTSNValidation ensures mismatched or missing values fail.
func TestTSNValidation(t *testing.T) {
	t.Setenv("CAPTURE_TSN_ENABLED", "true")
	t.Setenv("CAPTURE_TSN_INTERFACE", "eth0")
	t.Setenv("CAPTURE_TSN_QUEUE", "1")
	t.Setenv("CAPTURE_TSN_PTP_GRANDMASTER", "gm1")
	t.Setenv("PTP_GRANDMASTER_ID", "gm2")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected grandmaster mismatch")
	}
}
