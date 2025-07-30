// /host/services/capture-daemon/scanner/csi_or_usb.go
package scanner

import (
    "fmt"
    "os"
    "path/filepath"
    "syscall"
    "unsafe"
)

// these constants come from <linux/videodev2.h>
const (
    VIDIOC_QUERYCAP = 0x80685600
    V4L2_CAP_VIDEO_CAPTURE = 0x00000001
)

type v4l2_capability struct {
    Driver       [16]byte
    Card         [32]byte
    BusInfo      [32]byte
    Version      uint32
    Capabilities uint32
    Reserved     [4]uint32
}

// findFirstCaptureDevice returns the first /dev/videoN that
// actually has V4L2_CAP_VIDEO_CAPTURE set.
func findFirstCaptureDevice() (string, error) {
    for _, node := range sortedVideoNodes() {
        if isCaptureNode(node) {
            return node, nil
        }
    }
    return "", fmt.Errorf("no video capture devices found")
}

// sortedVideoNodes returns a deterministic list of "/dev/video*" sorted by N
func sortedVideoNodes() []string {
    matches, _ := filepath.Glob("/dev/video*")
    // you can add a sort.Slice here if order matters
    return matches
}

// isCaptureNode does the VIDIOC_QUERYCAP ioctl and checks the CAP flag
func isCaptureNode(dev string) bool {
    f, err := os.OpenFile(dev, os.O_RDONLY|syscall.O_NONBLOCK, 0)
    if err != nil {
        return false
    }
    defer f.Close()

    var caps v4l2_capability
    _, _, errno := syscall.Syscall(syscall.SYS_IOCTL, f.Fd(),
        VIDIOC_QUERYCAP, uintptr(unsafe.Pointer(&caps)))
    if errno != 0 {
        return false
    }
    return caps.Capabilities&V4L2_CAP_VIDEO_CAPTURE != 0
}

func main() {
    dev, err := findFirstCaptureDevice()
    if err != nil {
        fmt.Println("❌", err)
        os.Exit(1)
    }
    fmt.Println("✅ using video device:", dev)
    // ... now pass `dev` into your FFmpeg command builder
}