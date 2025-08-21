package tenant

import "testing"

func TestPlanFor(t *testing.T) {
	cases := []struct {
		profile     Profile
		nodes       int
		achievement Achievement
		storageMode string
		servers     int
		replicas    int
		quorum      bool
		tls         bool
		capDist     bool
		capQuorum   bool
		capTLS      bool
	}{
		{ProfileDev, 1, Solo, "fs", 1, 1, false, false, false, false, false},
		{ProfileEdge, 2, Party, "distributed", 2, 2, false, true, true, false, true},
		{ProfileProd, 3, Guild, "distributed", 3, 3, true, true, true, true, true},
		{ProfileProd, 5, Realm, "distributed", 5, 3, true, true, true, true, true},
	}
	for _, c := range cases {
		p := PlanFor(c.profile, ClusterState{Nodes: c.nodes})
		if p.Achievement.Code != c.achievement {
			t.Fatalf("achievement: got %s want %s", p.Achievement.Code, c.achievement)
		}
		caps := p.Achievement.Capabilities
		if caps.DistributedStorage != c.capDist || caps.QuorumQueues != c.capQuorum || caps.TLSEnforced != c.capTLS {
			t.Fatalf("capabilities mismatch: %+v", caps)
		}
		if p.Storage.Mode != c.storageMode || p.Storage.Servers != c.servers {
			t.Fatalf("storage: %+v", p.Storage)
		}
		if p.Queue.Replicas != c.replicas {
			t.Fatalf("replicas: %d want %d", p.Queue.Replicas, c.replicas)
		}
		if p.Queue.QuorumQueues != c.quorum {
			t.Fatalf("quorum: %v want %v", p.Queue.QuorumQueues, c.quorum)
		}
		if p.Storage.RequireTLS != c.tls || p.Queue.RequireTLS != c.tls {
			t.Fatalf("tls mismatch")
		}
	}
}
