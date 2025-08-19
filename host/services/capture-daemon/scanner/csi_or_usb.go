// /host/services/capture-daemon/scanner/csi_or_usb.go
package scanner

// Legacy wrappers that forward to the shared scanner helpers. These keep the
// old function names so existing code continues to compile.

import (
	"fmt"

	sharedscanner "github.com/Cdaprod/ThatDamToolbox/host/services/shared/scanner"
)

// findFirstCaptureDevice returns the first /dev/videoN that has capture
// capabilities by delegating to the shared helpers.
func findFirstCaptureDevice() (string, error) {
	for _, node := range sortedVideoNodes() {
		if IsCaptureNode(node) {
			return node, nil
		}
	}
	return "", fmt.Errorf("no video capture devices found")
}

// sortedVideoNodes returns a deterministic list of "/dev/video*" nodes.
func sortedVideoNodes() []string { return sharedscanner.SortedVideoNodes() }

// IsCaptureNode checks if the given node exposes capture capabilities.
func IsCaptureNode(dev string) bool { return sharedscanner.IsCaptureNode(dev) }
