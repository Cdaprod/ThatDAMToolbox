package model

// Plan from Supervisor.
type Plan struct {
	Role       string
	Services   []ServiceSpec
	ControlURL string
	GatewayURL string
	Epoch      int64
	TTL        int
}

type ServiceSpec struct {
	Name      string
	Image     string
	Args      []string
	Env       map[string]string
	Ports     []string
	Volumes   []string
	Profile   string
	Health    HealthSpec
	DependsOn []string
}

type HealthSpec struct {
	URL      string
	TimeoutS int
	Retries  int
}

// Profile from Supervisor.
type Profile struct {
	Storage []StorageBucket
	Broker  BrokerSpec
	Index   IndexSpec
}

type StorageBucket struct {
	Name      string
	Versioned bool
}

type BrokerSpec struct {
	Exchanges []Exchange
	Queues    []Queue
	Bindings  []Binding
}

type Exchange struct{ Name, Type string }

type Queue struct{ Name string }

type Binding struct{ Exchange, Queue, Key string }

type IndexSpec struct {
	Classes []ClassSpec
}

type ClassSpec struct {
	Name       string
	Properties []PropertySpec
}

type PropertySpec struct{ Name, Type string }

// App is deterministic runner input.
type App struct {
	NodeID   string
	Role     string
	Services []ServiceSpec
	Env      map[string]string
}

// CreateApp reduces plan and profile into a deterministic App.
func CreateApp(nodeID string, p Plan, prof Profile) App {
	return App{
		NodeID:   nodeID,
		Role:     p.Role,
		Services: p.Services,
		Env: map[string]string{
			"CONTROL_URL": p.ControlURL,
			"GATEWAY_URL": p.GatewayURL,
		},
	}
}
