package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"testing"

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
	proxy, err := NewDeviceProxy("http://backend", "http://frontend")
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
	dp, _ := NewDeviceProxy("http://b", "http://f")
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
	dp, _ := NewDeviceProxy("http://b", "http://f")
	dp.daemonURL = srv.URL
	dp.daemonToken = "secret"
	pc, _ := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err := dp.negotiateWithDaemon(pc); err != nil {
		t.Fatalf("negotiateWithDaemon: %v", err)
	}
}

// TestHealthz ensures the health endpoint returns 200.
func TestHealthz(t *testing.T) {
	dp, _ := NewDeviceProxy("http://b", "http://f")
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
	dp, _ := NewDeviceProxy("http://b", "http://f")
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
	dp, _ := NewDeviceProxy("http://b", "http://f")
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
	dp, _ := NewDeviceProxy("http://b", "http://f")
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
	if err := dp.streamFromFFmpeg(context.Background(), "/dev/video0", track); err != nil {
		t.Fatalf("streamFromFFmpeg: %v", err)
	}
	if !called {
		t.Fatalf("ffmpegCmd not called")
	}
}
