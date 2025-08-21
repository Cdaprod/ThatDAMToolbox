package path

import "testing"

func TestRank(t *testing.T) {
	paths := []Path{{Endpoint: "edge-a", LatencyMS: 50, CapacityKbps: 4000}, {Endpoint: "edge-b", LatencyMS: 20, CapacityKbps: 5000}}
	ranked := Rank(paths)
	if ranked[0].Endpoint != "edge-b" {
		t.Fatalf("expected edge-b first, got %s", ranked[0].Endpoint)
	}
	if ranked[1].Endpoint != "edge-a" {
		t.Fatalf("expected edge-a second")
	}
}
