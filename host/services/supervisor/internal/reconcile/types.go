package reconcile

// Package reconcile defines idempotent reconcilers for storage, broker and index.

import "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"

// StorageBucket describes desired storage configuration.
type StorageBucket struct {
	Name      string
	Versioned bool
	Lifecycle []ports.BucketLifecycleRule
	Tags      map[string]string
}

// BrokerSpec describes desired messaging setup.
type BrokerSpec struct {
	Exchanges []ports.Exchange
	Queues    []ports.Queue
	Bindings  []ports.Binding
}

// IndexSpec describes desired vector index schema.
type IndexSpec struct {
	Classes []ports.ClassSpec
}

// Profile aggregates desired state for all components.
type Profile struct {
	Storage []StorageBucket
	Broker  BrokerSpec
	Index   IndexSpec
}
