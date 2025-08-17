package bootstrap

import (
	"context"
	"os"

	runtimedocker "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/adapters/runtime_docker"
	runtimeexec "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/adapters/runtime_exec"
	runtimens "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/adapters/runtime_ns"
	ports "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/ports"
)

// Adapters bundles dependencies used during bootstrap.
//
// Example:
//
//	adapters, err := NewAdapters(context.Background())
//	if err != nil {
//	    // handle error
//	}
type Adapters struct {
	Storage interface{}
	Bus     interface{}
	Index   interface{}
	Runtime ports.ServiceRuntime
}

// NewAdapters selects bootstrap adapters based on environment variables.
func NewAdapters(ctx context.Context) (Adapters, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	return Adapters{Runtime: ChooseRuntime()}, nil
}

// ChooseRuntime selects a ServiceRuntime based on the host environment.
//
// It prefers Docker if the docker socket is present, then a namespace runtime
// if NS_ROOTFS is set, and finally falls back to a simple exec-based runtime.
func ChooseRuntime() ports.ServiceRuntime {
	if _, err := os.Stat("/var/run/docker.sock"); err == nil {
		return runtimedocker.New("")
	}
	if root := os.Getenv("NS_ROOTFS"); root != "" {
		return runtimens.New(root)
	}
	return runtimeexec.New()
}
