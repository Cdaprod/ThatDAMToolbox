package abr

import "testing"

func ladder() []Profile {
	return []Profile{
		{Resolution: "1920x1080", FPS: 60, Bitrate: 12_000_000},
		{Resolution: "1920x1080", FPS: 30, Bitrate: 8_000_000},
		{Resolution: "1280x720", FPS: 30, Bitrate: 4_000_000},
	}
}

func TestUpdateAndApply(t *testing.T) {
	c := NewController(ladder())
	var applied Profile
	c.Apply(10_000_000, func(p Profile) { applied = p })
	if applied.Bitrate != 8_000_000 {
		t.Fatalf("expected 8Mbps, got %d", applied.Bitrate)
	}
	c.Apply(3_000_000, func(p Profile) { applied = p })
	if applied.Bitrate != 4_000_000 {
		t.Fatalf("expected 4Mbps, got %d", applied.Bitrate)
	}
	c.Apply(15_000_000, func(p Profile) { applied = p })
	if applied.Bitrate != 12_000_000 {
		t.Fatalf("expected 12Mbps, got %d", applied.Bitrate)
	}
}
