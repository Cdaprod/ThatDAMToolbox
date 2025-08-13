// Package scanner provides helpers for discovering capture devices across services.
//
// Functions here mirror legacy helpers but live in the shared module so both
// capture-daemon and camera-proxy can rely on the same implementation.
//
// Example:
//
//	if scanner.IsCaptureNode("/dev/video0") {
//	    fmt.Println("usable")
//	}
package scanner

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"
)

// These constants come from <linux/videodev2.h>.
const (
	VIDIOC_QUERYCAP        = 0x80685600
	V4L2_CAP_VIDEO_CAPTURE = 0x00000001
)

// v4l2Capability is a minimal struct for the VIDIOC_QUERYCAP ioctl.
type v4l2Capability struct {
	Driver       [16]byte
	Card         [32]byte
	BusInfo      [32]byte
	Version      uint32
	Capabilities uint32
	Reserved     [4]uint32
}

// IsCaptureNode reports whether the given device exposes the
// V4L2_CAP_VIDEO_CAPTURE capability.
func IsCaptureNode(dev string) bool {
	f, err := os.OpenFile(dev, os.O_RDONLY|syscall.O_NONBLOCK, 0)
	if err != nil {
		return false
	}
	defer f.Close()

	var caps v4l2Capability
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, f.Fd(),
		VIDIOC_QUERYCAP, uintptr(unsafe.Pointer(&caps)))
	if errno != 0 {
		return false
	}
	return caps.Capabilities&V4L2_CAP_VIDEO_CAPTURE != 0
}

// SortedVideoNodes returns a deterministic list of /dev/video* nodes.
func SortedVideoNodes() []string {
	matches, _ := filepath.Glob("/dev/video*")
	return matches
}

// findFirstCaptureDevice returns the first capture-capable node.
func findFirstCaptureDevice() (string, error) {
	for _, node := range SortedVideoNodes() {
		if IsCaptureNode(node) {
			return node, nil
		}
	}
	return "", fmt.Errorf("no video capture devices found")
}
