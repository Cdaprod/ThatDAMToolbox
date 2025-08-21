// Package path provides simple path scoring for overlay endpoints.
//
// Example:
//
//	best := path.Rank([]path.Path{{Endpoint:"edge-a",LatencyMS:20,CapacityKbps:5000}})[0]
package path

import "sort"

// Path describes a candidate endpoint path.
type Path struct {
	Endpoint     string
	LatencyMS    int
	CapacityKbps int
}

// score returns a ranking value for the path.
func (p Path) score() int {
	return p.CapacityKbps - p.LatencyMS
}

// Rank orders paths by their score from best to worst.
func Rank(paths []Path) []Path {
	ranked := make([]Path, len(paths))
	copy(ranked, paths)
	sort.SliceStable(ranked, func(i, j int) bool {
		return ranked[i].score() > ranked[j].score()
	})
	return ranked
}
