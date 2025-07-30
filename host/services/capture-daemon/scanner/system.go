// /host/services/capture-daemon/scanner/system.go
package scanner

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"syscall"
	"unsafe"
)

// ---------- low-level V4L2 constants & structs ----------
const (
	vidIOC_QUERYCAP     = 0x80685600          // VIDIOC_QUERYCAP ioctl number
	v4l2CapVideoCapture = 0x00000001          // V4L2_CAP_VIDEO_CAPTURE
)

type v4l2Capability struct {
	Driver       [16]byte
	Card         [32]byte
	BusInfo      [32]byte
	Version      uint32
	Capabilities uint32
	Reserved     [4]uint32
}

// ---------- scanner plugin registration ----------
func init() {
	Register(systemScanner{})
}

type systemScanner struct{}

// Scan discovers **one** usable /dev/video* node and returns it as a Device.
func (systemScanner) Scan() ([]Device, error) {
	dev, err := findFirstCaptureDevice()
	if err != nil {
		return nil, err
	}
	return []Device{{
		ID:   dev,
		Kind: "system",
		Path: dev,
		Name: filepath.Base(dev),
		Capabilities: map[string]interface{}{
			"source": "system",
		},
		Status: "online",
	}}, nil
}

// ---------- helper functions (finished in-place) ----------

// findFirstCaptureDevice returns the first /dev/videoN that supports V4L2_CAP_VIDEO_CAPTURE.
func findFirstCaptureDevice() (string, error) {
	for _, node := range sortedVideoNodes() {
		if isCaptureNode(node) {
			return node, nil
		}
	}
	return "", fmt.Errorf("no video capture devices with V4L2_CAP_VIDEO_CAPTURE found")
}

// sortedVideoNodes returns /dev/video* entries sorted numerically (video0, video1, …).
func sortedVideoNodes() []string {
	nodes, _ := filepath.Glob("/dev/video*")
	sort.Slice(nodes, func(i, j int) bool {
		return videoIndex(nodes[i]) < videoIndex(nodes[j])
	})
	return nodes
}

// videoIndex extracts the integer suffix from "videoN"; returns a large number on failure.
func videoIndex(path string) int {
	var n int
	if _, err := fmt.Sscanf(filepath.Base(path), "video%d", &n); err != nil {
		return 1 << 30 // put malformed names last
	}
	return n
}

// isCaptureNode performs VIDIOC_QUERYCAP and checks the video-capture flag.
func isCaptureNode(dev string) bool {
	f, err := os.OpenFile(dev, os.O_RDONLY|syscall.O_NONBLOCK, 0)
	if err != nil {
		return false
	}
	defer f.Close()

	var caps v4l2Capability
	_, _, errno := syscall.Syscall(
		syscall.SYS_IOCTL,
		f.Fd(),
		uintptr(vidIOC_QUERYCAP),
		uintptr(unsafe.Pointer(&caps)),
	)
	if errno != 0 {
		return false
	}
	return caps.Capabilities&v4l2CapVideoCapture != 0
}