package main

import (
	"reflect"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
)

func TestOrderApps(t *testing.T) {
	apps := []plan.AppSpec{
		{Name: "api", After: []string{"db"}},
		{Name: "web", After: []string{"api"}},
		{Name: "db"},
	}
	ordered, err := orderApps(apps)
	if err != nil {
		t.Fatalf("order: %v", err)
	}
	got := []string{ordered[0].Name, ordered[1].Name, ordered[2].Name}
	want := []string{"db", "api", "web"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestOrderAppsCycle(t *testing.T) {
	apps := []plan.AppSpec{{Name: "a", After: []string{"b"}}, {Name: "b", After: []string{"a"}}}
	if _, err := orderApps(apps); err == nil {
		t.Fatal("expected cycle error")
	}
}
