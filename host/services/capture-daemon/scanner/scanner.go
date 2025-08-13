// /host/services/capture-daemon/scanner/scanner.go
package scanner

// This package now wraps the shared scanner implementation so existing imports
// continue to function while discovery logic lives in host/services/shared.

import sharedscanner "github.com/Cdaprod/ThatDamToolbox/host/services/shared/scanner"

// Device represents everything we know about a discovered capture device.
// It aliases the shared Device type for backward compatibility.
type Device = sharedscanner.Device

// Scanner is implemented by each discovery module.
type Scanner = sharedscanner.Scanner

// Register adds a new discovery backend (called in each scanner’s init).
func Register(s Scanner) {
	sharedscanner.Register(s)
}

// ScanAll runs every registered scanner and merges their results.
func ScanAll() ([]Device, error) {
	return sharedscanner.ScanAll()
}
