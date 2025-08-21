package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/hostcap/v4l2probe"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/ptp"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/scanner"
	"github.com/pion/webrtc/v3"
)

// TestDiscoverDevicesIncludesDaemon ensures capture-daemon devices are merged.
func TestDiscoverDevicesIncludesDaemon(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret" {
			t.Fatalf("missing auth header")
		}
		if r.URL.Path == "/devices" {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`[{"id":"/dev/video1","name":"cam"}]`))
		}
	}))
	defer srv.Close()
	t.Setenv("CAPTURE_DAEMON_URL", srv.URL)
	t.Setenv("CAPTURE_DAEMON_TOKEN", "secret")
	proxy, err := NewDeviceProxy("http://backend", "http://frontend", ptp.New())
	if err != nil {
		t.Fatalf("NewDeviceProxy: %v", err)
	}
	if err := proxy.discoverDevices(); err != nil {
		t.Fatalf("discoverDevices: %v", err)
	}
	if _, ok := proxy.devices["daemon:/dev/video1"]; !ok {
		t.Fatalf("expected daemon device to be merged")
	}
}

// TestDiscoverDevicesLogsOnce ensures repeated discovery doesn't spam logs.
func TestDiscoverDevicesLogsOnce(t *testing.T) {
	scanner.Register(fakeScanner{})
	dp, _ := NewDeviceProxy("http://b", "http://f", ptp.New())

	var buf bytes.Buffer
	logx.Init(logx.Config{Service: "camera-proxy", Writer: &buf, Format: "text"})

	if err := dp.discoverDevices(); err != nil {
		t.Fatalf("discoverDevices first: %v", err)
	}
	if c := strings.Count(buf.String(), "device discovered"); c != 1 {
		t.Fatalf("expected 1 log, got %d", c)
	}
	buf.Reset()
	if err := dp.discoverDevices(); err != nil {
		t.Fatalf("discoverDevices second: %v", err)
	}
	if c := strings.Count(buf.String(), "device discovered"); c != 0 {
		t.Fatalf("expected no new logs, got %d", c)
	}
}

type fakeScanner struct{}

func (fakeScanner) Scan() ([]scanner.Device, error) {
	return []scanner.Device{{Path: "/dev/fake", Name: "FakeCam"}}, nil
}

// TestRegisterWithDaemon posts local devices to /register.
func TestRegisterWithDaemon(t *testing.T) {
	var posted bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret" {
			t.Fatalf("missing auth header")
		}
		if r.URL.Path != "/register" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		posted = true
		var payload struct {
			ProxyID string       `json:"proxy_id"`
			Devices []DeviceInfo `json:"devices"`
		}
		_ = json.NewDecoder(r.Body).Decode(&payload)
		if payload.ProxyID == "" || len(payload.Devices) != 1 {
			t.Fatalf("bad payload: %+v", payload)
		}
	}))
	defer srv.Close()
	dp, _ := NewDeviceProxy("http://b", "http://f", ptp.New())
	dp.daemonURL = srv.URL
	dp.daemonToken = "secret"
	dp.devices["/dev/video0"] = &DeviceInfo{Path: "/dev/video0", Name: "cam", IsAvailable: true}
	if err := dp.registerWithDaemon(context.Background()); err != nil {
		t.Fatalf("registerWithDaemon: %v", err)
	}
	if !posted {
		t.Fatalf("expected POST to /register")
	}
}

// TestNegotiateWithDaemon verifies SDP exchange with mock server.
func TestNegotiateWithDaemon(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret" {
			t.Fatalf("missing auth header")
		}
		if r.URL.Path != "/webrtc/offer" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var req struct {
			SDP webrtc.SessionDescription `json:"sdp"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		pc, _ := webrtc.NewPeerConnection(webrtc.Configuration{})
		defer pc.Close()
		_ = pc.SetRemoteDescription(req.SDP)
		ans, _ := pc.CreateAnswer(nil)
		_ = pc.SetLocalDescription(ans)
		_ = json.NewEncoder(w).Encode(map[string]any{"sdp": ans})
	}))
	defer srv.Close()
	dp, _ := NewDeviceProxy("http://b", "http://f", ptp.New())
	dp.daemonURL = srv.URL
	dp.daemonToken = "secret"
	pc, _ := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err := dp.negotiateWithDaemon(pc); err != nil {
		t.Fatalf("negotiateWithDaemon: %v", err)
	}
}

// TestHealthz ensures the health endpoint returns 200.
func TestHealthz(t *testing.T) {
	dp, _ := NewDeviceProxy("http://b", "http://f", ptp.New())
	srv := httptest.NewServer(dp.setupRoutes())
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatalf("healthz request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

// TestHandleDeviceStreamRedirect verifies daemon devices redirect to HLS.
func TestHandleDeviceStreamRedirect(t *testing.T) {
	dp, _ := NewDeviceProxy("http://b", "http://f", ptp.New())
	dp.devices["daemon:cam1"] = &DeviceInfo{Path: "daemon:cam1", IsAvailable: true}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/stream?device=daemon:cam1", nil)
	dp.handleDeviceStream(rr, req)
	if rr.Code != http.StatusTemporaryRedirect {
		t.Fatalf("expected 307, got %d", rr.Code)
	}
	expected := dp.daemonURL + "/preview/cam1/index.m3u8"
	if loc := rr.Header().Get("Location"); loc != expected {
		t.Fatalf("redirect to %s, got %s", expected, loc)
	}
}

// TestHandleDeviceStreamFallback ensures MJPEG fallback when WebRTC fails.
func TestHandleDeviceStreamFallback(t *testing.T) {
	dp, _ := NewDeviceProxy("http://b", "http://f", ptp.New())
	dp.daemonURL = "http://invalid"
	dp.devices["/dev/video0"] = &DeviceInfo{Path: "/dev/video0", IsAvailable: true}
	orig := ffmpegCmd
	ffmpegCmd = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		return exec.CommandContext(ctx, "sh", "-c", "echo frame")
	}
	defer func() { ffmpegCmd = orig }()
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/stream?device=%2Fdev%2Fvideo0", nil)
	dp.handleDeviceStream(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); !strings.HasPrefix(ct, "multipart/x-mixed-replace") {
		t.Fatalf("unexpected content type: %s", ct)
	}
}

// TestDebugV4L2 exposes the probe results via /debug/v4l2.
func TestDebugV4L2(t *testing.T) {
	dp, _ := NewDeviceProxy("http://b", "http://f", ptp.New())
	dp.probeKept = []v4l2probe.Device{{Node: "/dev/video19", Name: "rpivid", Kind: "m2m-decoder"}}
	dp.probeDropped = []v4l2probe.Device{{Node: "/dev/video0", Name: "pispbe", Kind: "ignored"}}
	srv := httptest.NewServer(dp.setupRoutes())
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/debug/v4l2")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	var out struct {
		Kept    []v4l2probe.Device `json:"kept"`
		Dropped []v4l2probe.Device `json:"dropped"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(out.Kept) != 1 || out.Kept[0].Node != "/dev/video19" {
		t.Fatalf("unexpected response: %+v", out)
	}
}

// TestViewerServed verifies static viewer files are served from VIEWER_DIR.
func TestViewerServed(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("ok"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}
	t.Setenv("VIEWER_DIR", dir)
	dp, _ := NewDeviceProxy("http://b", "http://f", ptp.New())
	srv := httptest.NewServer(dp.setupRoutes())
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/viewer/index.html")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if string(b) != "ok" {
		t.Fatalf("unexpected body: %s", b)
	}

}

// TestHandleSRT exposes negotiated SRT URLs.
func TestHandleSRT(t *testing.T) {
	t.Setenv("SRT_BASE_URL", "srt://localhost:9000")
	dp, _ := NewDeviceProxy("http://b", "http://f")
	srv := httptest.NewServer(dp.setupRoutes())
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/srt?device=cam1")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	var out map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out["uri"] != "srt://localhost:9000?streamid=cam1" {
		t.Fatalf("unexpected uri: %s", out["uri"])
	}
}

// TestIceServers parses ICE_SERVERS env variable.
func TestIceServers(t *testing.T) {
	t.Setenv("ICE_SERVERS", "stun:stun.example.org, turn:turn.example.org")
	servers := iceServers()
	if len(servers) != 2 || servers[1].URLs[0] != "turn:turn.example.org" {
		t.Fatalf("unexpected servers: %+v", servers)
	}
}

// TestHWAccelArgs ensures FFMPEG_HWACCEL is inserted into ffmpeg command.
func TestHWAccelArgs(t *testing.T) {
	dp, _ := NewDeviceProxy("http://b", "http://f", ptp.New())
	t.Setenv("FFMPEG_HWACCEL", "cuda -hwaccel_device 0")
	called := false
	orig := ffmpegCmd
	ffmpegCmd = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		called = true
		if args[0] != "cuda" {
			t.Fatalf("missing hw accel args: %v", args)
		}
		return exec.CommandContext(ctx, "sh", "-c", "echo data")
	}
	defer func() { ffmpegCmd = orig }()
	track, _ := webrtc.NewTrackLocalStaticSample(webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264}, "v", "p")
	if err := dp.streamFromFFmpeg(context.Background(), "/dev/video0", track, dp.abrCtrl.Current().Bitrate); err != nil {
		t.Fatalf("streamFromFFmpeg: %v", err)
	}
	if !called {
		t.Fatalf("ffmpegCmd not called")
	}
}
