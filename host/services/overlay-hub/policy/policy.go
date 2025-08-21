// Package policy defines class-based rules and ACL checks for overlay agents.
//
// Example:
//
//	p := policy.New()
//	ceiling, ok := p.Check("agent1", "realtime")
//	if !ok {
//	    // denied
//	}
package policy

// Rule represents access control for a class and its ABR ceiling in kbps.
type Rule struct {
	AllowedAgents map[string]bool
	ABRCeiling    int
}

// Policy holds class rules.
type Policy struct {
	Rules map[string]Rule
}

// New returns a default policy with demo agents and classes.
func New() Policy {
	return Policy{Rules: map[string]Rule{
		"realtime": {AllowedAgents: map[string]bool{"agent1": true, "agent2": true}, ABRCeiling: 3000},
		"bulk":     {AllowedAgents: map[string]bool{"agent1": true}, ABRCeiling: 1000},
	}}
}

// Check verifies that agent may use class. It returns the ABR ceiling in kbps and
// a boolean indicating allowance.
func (p Policy) Check(agentID, class string) (int, bool) {
	rule, ok := p.Rules[class]
	if !ok {
		return 0, false
	}
	if !rule.AllowedAgents[agentID] {
		return 0, false
	}
	return rule.ABRCeiling, true
}
