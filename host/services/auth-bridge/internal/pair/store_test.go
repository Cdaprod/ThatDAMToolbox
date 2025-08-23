package pair

import "testing"

func TestCreateApprove(t *testing.T) {
	Create("CODE1", "dev1")
	if ok, _ := GetByDevice("dev1"); !ok {
		t.Fatalf("device not stored")
	}
	if !Approve("CODE1", "tenant", "njt123") {
		t.Fatalf("approve failed")
	}
	ok, p := GetByDevice("dev1")
	if !ok || !p.Approved || p.NJT != "njt123" {
		t.Fatalf("approval not stored")
	}
}
