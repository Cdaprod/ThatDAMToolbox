package pair

import (
	"sync"
	"time"
)

type pending struct {
	Device   string
	Tenant   string
	Expires  time.Time
	Approved bool
	NJT      string
}

var (
	mu   sync.Mutex
	data = map[string]*pending{}
)

// Create registers a device and user verification code.
// Example:
//
//	pair.Create("ABC123", "dev1")
func Create(code, device string) {
	mu.Lock()
	defer mu.Unlock()
	data[code] = &pending{Device: device, Expires: time.Now().Add(5 * time.Minute)}
}

// Approve marks a pending code as approved with tenant and NJT.
func Approve(code, tenant, njt string) bool {
	mu.Lock()
	defer mu.Unlock()
	p, ok := data[code]
	if !ok || time.Now().After(p.Expires) {
		return false
	}
	p.Tenant, p.Approved, p.NJT = tenant, true, njt
	return true
}

// GetByDevice returns pending info for a device.
func GetByDevice(device string) (bool, *pending) {
	mu.Lock()
	defer mu.Unlock()
	for _, v := range data {
		if v.Device == device {
			return true, v
		}
	}
	return false, nil
}
