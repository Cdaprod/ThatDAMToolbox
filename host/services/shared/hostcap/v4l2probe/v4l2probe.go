package v4l2probe

// Package v4l2probe provides cross-service V4L2 device discovery with
// Raspberry Pi pipeline filters. Use Discover to find devices.
//
// Example:
//
//  ctx := context.Background()
//  kept, dropped, err := v4l2probe.Discover(ctx, v4l2probe.DefaultOptions())
//  if err != nil { log.Fatal(err) }
//  fmt.Println("usable devices", kept)
//
import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"syscall"
	"unsafe"
)

const sysV4L = "/sys/class/video4linux"

// Device describes a V4L2 node and how it was classified.
type Device struct {
	Node string `json:"node"` // /dev/videoX
	Name string `json:"name"` // sysfs "name"
	Caps string `json:"caps"` // textual capability summary
	Kind string `json:"kind"` // "capture" | "m2m-decoder" | "ignored"
}

// Options tunes discovery filters.
type Options struct {
	// Substrings that must NOT appear in the lowercase device name.
	HardExclude []string
	// Substrings allowed for M2M decoder nodes (e.g., "rpivid").
	AllowM2M []string
}

// DefaultOptions returns Pi-friendly defaults excluding internal pipelines
// and allowing the rpivid decoder.
func DefaultOptions() Options {
	return Options{
		HardExclude: []string{"pispbe", "pisp", "vc4", "bcm2835-isp"},
		AllowM2M:    []string{"rpivid"},
	}
}

// v4l2_capability mirrors struct v4l2_capability from videodev2.h.
type v4l2_capability struct {
	driver       [16]byte
	card         [32]byte
	bus_info     [32]byte
	version      uint32
	capabilities uint32
	device_caps  uint32
	reserved     [3]uint32
}

const (
	VIDIOC_QUERYCAP               = 0x80685600
	V4L2_CAP_VIDEO_CAPTURE        = 0x00000001
	V4L2_CAP_VIDEO_OUTPUT         = 0x00000002
	V4L2_CAP_VIDEO_OVERLAY        = 0x00000004
	V4L2_CAP_VBI_CAPTURE          = 0x00000010
	V4L2_CAP_VBI_OUTPUT           = 0x00000020
	V4L2_CAP_SLICED_VBI_CAPTURE   = 0x00000040
	V4L2_CAP_SLICED_VBI_OUTPUT    = 0x00000080
	V4L2_CAP_RDS_CAPTURE          = 0x00000100
	V4L2_CAP_VIDEO_CAPTURE_MPLANE = 0x00001000
	V4L2_CAP_VIDEO_OUTPUT_MPLANE  = 0x00002000
	V4L2_CAP_VIDEO_M2M            = 0x00004000
	V4L2_CAP_VIDEO_M2M_MPLANE     = 0x00008000
)

func ioctl(fd uintptr, req, arg uintptr) error {
	_, _, e := syscall.Syscall(syscall.SYS_IOCTL, fd, req, arg)
	if e != 0 {
		return e
	}
	return nil
}

func readFirstLine(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	s := string(b)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return strings.TrimSpace(s)
}

func capStrings(devCaps, caps uint32) (out []string) {
	add := func(flag uint32, name string) {
		if (caps&flag) != 0 || (devCaps&flag) != 0 {
			out = append(out, name)
		}
	}
	add(V4L2_CAP_VIDEO_CAPTURE, "CAPTURE")
	add(V4L2_CAP_VIDEO_CAPTURE_MPLANE, "CAPTURE_MPLANE")
	add(V4L2_CAP_VIDEO_OUTPUT, "OUTPUT")
	add(V4L2_CAP_VIDEO_OUTPUT_MPLANE, "OUTPUT_MPLANE")
	add(V4L2_CAP_VIDEO_M2M, "M2M")
	add(V4L2_CAP_VIDEO_M2M_MPLANE, "M2M_MPLANE")
	slices.Sort(out)
	return
}

func queryCaps(devPath string) (name string, devCaps, caps uint32, err error) {
	base := filepath.Base(devPath)
	name = readFirstLine(filepath.Join(sysV4L, base, "name"))

	f, errOpen := os.OpenFile(devPath, os.O_RDWR|syscall.O_NONBLOCK, 0)
	if errOpen != nil {
		f, errOpen = os.OpenFile(devPath, os.O_RDONLY|syscall.O_NONBLOCK, 0)
	}
	if errOpen != nil {
		return name, 0, 0, errOpen
	}
	defer f.Close()

	var cap v4l2_capability
	if err = ioctl(f.Fd(), VIDIOC_QUERYCAP, uintptr(unsafe.Pointer(&cap))); err != nil {
		return name, 0, 0, err
	}
	devCaps = cap.device_caps
	caps = cap.capabilities
	if devCaps == 0 {
		devCaps = caps
	}
	return name, devCaps, caps, nil
}

func classify(name string, devCaps, caps uint32, opt Options) (kind string, accept bool) {
	ln := strings.ToLower(name)
	for _, bad := range opt.HardExclude {
		if strings.Contains(ln, bad) {
			return "ignored-internal-pipeline", false
		}
	}
	if (devCaps&V4L2_CAP_VIDEO_CAPTURE) != 0 || (devCaps&V4L2_CAP_VIDEO_CAPTURE_MPLANE) != 0 ||
		(caps&V4L2_CAP_VIDEO_CAPTURE) != 0 || (caps&V4L2_CAP_VIDEO_CAPTURE_MPLANE) != 0 {
		return "capture", true
	}
	if ((devCaps&V4L2_CAP_VIDEO_M2M) != 0 || (devCaps&V4L2_CAP_VIDEO_M2M_MPLANE) != 0 ||
		(caps&V4L2_CAP_VIDEO_M2M) != 0 || (caps&V4L2_CAP_VIDEO_M2M_MPLANE) != 0) &&
		substrAny(ln, opt.AllowM2M) {
		return "m2m-decoder", true
	}
	return "ignored", false
}

func substrAny(s string, needles []string) bool {
	for _, n := range needles {
		if strings.Contains(s, n) {
			return true
		}
	}
	return false
}

// Discover enumerates V4L2 nodes and classifies them.
func Discover(ctx context.Context, opt Options) (kept, dropped []Device, err error) {
	ents, err := os.ReadDir(sysV4L)
	if err != nil {
		return nil, nil, fmt.Errorf("read %s: %w", sysV4L, err)
	}
	for _, e := range ents {
		if !strings.HasPrefix(e.Name(), "video") {
			continue
		}
		select {
		case <-ctx.Done():
			return kept, dropped, ctx.Err()
		default:
		}
		node := filepath.Join("/dev", e.Name())
		name, devCaps, caps, qErr := queryCaps(node)
		if qErr != nil {
			dropped = append(dropped, Device{Node: node, Name: name, Caps: "ERR", Kind: "open-failed:" + qErr.Error()})
			continue
		}
		capStr := strings.Join(capStrings(devCaps, caps), "|")
		kind, ok := classify(name, devCaps, caps, opt)
		dev := Device{Node: node, Name: name, Caps: capStr, Kind: kind}
		if ok {
			kept = append(kept, dev)
		} else {
			dropped = append(dropped, dev)
		}
	}
	slices.SortFunc(kept, func(a, b Device) int { return strings.Compare(a.Node, b.Node) })
	slices.SortFunc(dropped, func(a, b Device) int { return strings.Compare(a.Node, b.Node) })
	return
}
