// Package tenant provides runtime-agnostic tenancy planning logic.
//
// Example usage:
//
//	plan := PlanFor(ProfileDev, ClusterState{Nodes:1})
package tenant

// Profile represents a runtime stance.
type Profile string

const (
	ProfileDev  Profile = "dev"
	ProfileEdge Profile = "edge"
	ProfileProd Profile = "prod"
)

// ClusterState captures observed capacity inputs.
type ClusterState struct {
	Nodes int
}

// Achievement denotes normalized tiers derived from ClusterState.
type Achievement string

const (
	Solo  Achievement = "Solo"
	Party Achievement = "Party"
	Guild Achievement = "Guild"
	Realm Achievement = "Realm"
)

// StoragePlan describes storage expectations for a tenant.
type StoragePlan struct {
	Mode             string
	Servers          int
	VolumesPerServer int
	Versioning       bool
	RequireTLS       bool
	EnableAuditHook  bool
}

// QueuePlan describes queue expectations for a tenant.
type QueuePlan struct {
	Replicas               int
	QuorumQueues           bool
	RequireTLS             bool
	DLXPerTenant           bool
	TracingToAuditExchange bool
}

// Plan (schema v1) combines storage and queue expectations.
type Plan struct {
	Profile     Profile         `json:"profile"`
	Achievement AchievementInfo `json:"achievement"`
	Storage     StoragePlan     `json:"storage"`
	Queue       QueuePlan       `json:"queue"`
}

// AchievementInfo exposes stable labels and capability flags for an achievement.
type AchievementInfo struct {
	Code         Achievement             `json:"code"`
	Title        string                  `json:"title"`
	Capabilities AchievementCapabilities `json:"capabilities"`
}

// AchievementCapabilities enumerates feature flags unlocked at each tier.
type AchievementCapabilities struct {
	DistributedStorage bool `json:"distributed_storage"`
	QuorumQueues       bool `json:"quorum_queues"`
	TLSEnforced        bool `json:"tls_enforced"`
	AuditStreaming     bool `json:"audit_streaming"`
}

// AchievementForNodes maps node count to deterministic achievement levels.
func AchievementForNodes(nodes int) Achievement {
	switch {
	case nodes <= 1:
		return Solo
	case nodes == 2:
		return Party
	case nodes == 3:
		return Guild
	default:
		return Realm
	}
}

// PlanFor deterministically computes a Plan from Profile and ClusterState.
func PlanFor(p Profile, cs ClusterState) Plan {
	achCode := AchievementForNodes(cs.Nodes)
	requireTLS := p != ProfileDev

	st := StoragePlan{
		Mode:             "fs",
		Servers:          1,
		VolumesPerServer: 1,
		Versioning:       true,
		RequireTLS:       requireTLS,
		EnableAuditHook:  true,
	}
	q := QueuePlan{
		Replicas:               1,
		QuorumQueues:           false,
		RequireTLS:             requireTLS,
		DLXPerTenant:           true,
		TracingToAuditExchange: true,
	}

	switch achCode {
	case Solo:
		// defaults already set
	case Party:
		st.Mode = "distributed"
		st.Servers = 2
		st.VolumesPerServer = 2
		q.Replicas = 2
	case Guild:
		st.Mode = "distributed"
		st.Servers = 3
		st.VolumesPerServer = 2
		q.Replicas = 3
		q.QuorumQueues = true
	case Realm:
		st.Mode = "distributed"
		if cs.Nodes < 4 {
			st.Servers = 4
		} else {
			st.Servers = cs.Nodes
		}
		st.VolumesPerServer = 2
		q.Replicas = 3
		q.QuorumQueues = true
	}

	if q.Replicas < 3 {
		q.QuorumQueues = false
	}

	ach := achievementInfo(achCode, requireTLS)
	return Plan{Profile: p, Achievement: ach, Storage: st, Queue: q}
}

// achievementInfo maps an achievement level and TLS requirement to human-friendly details.
func achievementInfo(a Achievement, tls bool) AchievementInfo {
	info := AchievementInfo{Code: a, Capabilities: AchievementCapabilities{AuditStreaming: true}}
	switch a {
	case Solo:
		info.Title = "Single-node development mode."
	case Party:
		info.Title = "Distributed storage unlocked; limited HA queues."
		info.Capabilities.DistributedStorage = true
	case Guild:
		info.Title = "Consensus achieved; production-grade queues."
		info.Capabilities.DistributedStorage = true
		info.Capabilities.QuorumQueues = true
	case Realm:
		info.Title = "High availability at scale; multi-pool storage."
		info.Capabilities.DistributedStorage = true
		info.Capabilities.QuorumQueues = true
	}
	info.Capabilities.TLSEnforced = tls
	return info
}
