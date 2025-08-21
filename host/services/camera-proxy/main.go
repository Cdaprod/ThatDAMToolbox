// Package main starts the camera-proxy service.
//
// The proxy discovers local camera devices and relays them to a capture-daemon
// using WebRTC. If negotiation with the daemon fails the proxy falls back to
// serving an MJPEG stream directly.
//
// Environment variables:
//
//		PROXY_PORT           - listening port (default 8000)
//	     BACKEND_URL          - backend address to proxy (default http://api-gateway:8080)
//		FRONTEND_URL         - frontend address to proxy (default http://localhost:3000)
//		CAPTURE_DAEMON_URL   - optional capture-daemon address
//		CAPTURE_DAEMON_TOKEN - bearer token for capture-daemon requests
//		TLS_CERT_FILE        - serve HTTPS using this certificate
//		TLS_KEY_FILE         - key for TLS_CERT_FILE
//
// Example:
//
//	PROXY_PORT=8000 BACKEND_URL=http://api-gateway:8080 \
//	FRONTEND_URL=http://localhost:3000 CAPTURE_DAEMON_URL=http://localhost:9000 \
//	./camera-proxy
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus"
	busamqp "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus/amqp"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/hostcap/v4l2probe"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/ptp"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/scanner"
	_ "github.com/Cdaprod/ThatDamToolbox/host/services/shared/scanner/v4l2"
	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
)

var (
	version   = "dev"
	ffmpegCmd = exec.CommandContext
)

// hwAccelArgs returns additional ffmpeg arguments from FFMPEG_HWACCEL.
func hwAccelArgs() []string {
	if v := os.Getenv("FFMPEG_HWACCEL"); v != "" {
		return strings.Fields(v)
	}
	return nil
}

// iceServers parses ICE_SERVERS as a comma-separated list of URLs.
func iceServers() []webrtc.ICEServer {
	v := os.Getenv("ICE_SERVERS")
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]webrtc.ICEServer, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		out = append(out, webrtc.ICEServer{URLs: []string{p}})
	}
	return out
}

// DeviceInfo represents camera device information
type DeviceInfo struct {
	Path         string                 `json:"path"`
	Name         string                 `json:"name"`
	IsAvailable  bool                   `json:"is_available"`
	Capabilities map[string]interface{} `json:"capabilities,omitempty"`
}

// DeviceProxy manages camera device virtualization and proxying
type DeviceProxy struct {
	devices      map[string]*DeviceInfo
	mutex        sync.RWMutex
	backendURL   *url.URL
	frontendURL  *url.URL
	upgrader     websocket.Upgrader
	daemonURL    string
	daemonToken  string
	probeKept    []v4l2probe.Device
	probeDropped []v4l2probe.Device
	usbSeen      map[string]struct{}
	ignoredSeen  map[string]struct{}
	clock        *ptp.Clock
}

// NewDeviceProxy creates a new transparent device proxy
func NewDeviceProxy(backendAddr, frontendAddr string, clock *ptp.Clock) (*DeviceProxy, error) {
	backendURL, err := url.Parse(backendAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid backend URL: %v", err)
	}

	frontendURL, err := url.Parse(frontendAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid frontend URL: %v", err)
	}

	allow := strings.Split(getEnv("ALLOWED_ORIGINS", ""), ",")
	return &DeviceProxy{
		devices:     make(map[string]*DeviceInfo),
		backendURL:  backendURL,
		frontendURL: frontendURL,
		daemonURL:   getEnv("CAPTURE_DAEMON_URL", "http://localhost:9000"),
		daemonToken: getEnv("CAPTURE_DAEMON_TOKEN", ""),
		usbSeen:     make(map[string]struct{}),
		ignoredSeen: make(map[string]struct{}),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				if len(allow) == 1 && allow[0] == "" {
					return true
				}
				origin := r.Header.Get("Origin")
				for _, a := range allow {
					if strings.TrimSpace(a) == origin {
						return true
					}
				}
				return false
			},
		},
		clock: clock,
	}, nil
}

// discoverDevices scans for camera devices and creates virtual device mappings
func (dp *DeviceProxy) discoverDevices() error {
	dp.mutex.Lock()
	defer dp.mutex.Unlock()

	prev := dp.devices
	dp.devices = make(map[string]*DeviceInfo)

	mergedFromDaemon := 0
	if dp.daemonURL != "" {
		req, _ := http.NewRequest(http.MethodGet, dp.daemonURL+"/devices", nil)
		if dp.daemonToken != "" {
			req.Header.Set("Authorization", "Bearer "+dp.daemonToken)
		}
		if resp, err := httpClient.Do(req); err == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			var daemonDevs []map[string]any
			if json.NewDecoder(resp.Body).Decode(&daemonDevs) == nil {
				for _, d := range daemonDevs {
					id, _ := d["id"].(string)
					name, _ := d["name"].(string)
					if id == "" {
						continue
					}
					key := "daemon:" + id
					dp.devices[key] = &DeviceInfo{Path: key, Name: name, IsAvailable: true}
					mergedFromDaemon++
				}
			}
		}
	}

	devs, err := scanner.ScanAll()
	if err != nil {
		logx.L.Error("device scan failed", "err", err)
	}
	for _, d := range devs {
		if _, exists := dp.devices[d.Path]; exists {
			continue
		}
		dp.devices[d.Path] = &DeviceInfo{
			Path:         d.Path,
			Name:         d.Name,
			IsAvailable:  true,
			Capabilities: d.Capabilities,
		}
		if _, seen := prev[d.Path]; !seen {
			logx.L.Info("device discovered", "name", d.Name, "path", d.Path)
		}
	}

	for k, d := range prev {
		if _, ok := dp.devices[k]; !ok {
			logx.L.Info("device removed", "name", d.Name, "path", d.Path)
		}
	}

	out := make([]DeviceInfo, 0, len(dp.devices))
	for _, d := range dp.devices {
		out = append(out, *d)
	}
	_ = bus.Publish("capture.device_list", out)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	opt := v4l2probe.DefaultOptions()
	dp.probeKept, dp.probeDropped, _ = v4l2probe.Discover(ctx, opt)
	for _, d := range dp.probeDropped {
		if _, logged := dp.ignoredSeen[d.Node]; !logged {
			logx.L.Info("ignoring device", "node", d.Node, "name", d.Name, "caps", d.Caps, "reason", d.Kind)
			dp.ignoredSeen[d.Node] = struct{}{}
		}
	}

	dp.scanUSBCameras()

	if mergedFromDaemon == 0 && len(devs) == 0 {
		return fmt.Errorf("no devices discovered from daemon or local probe")
	}
	return nil
}

var httpClient = &http.Client{Timeout: 5 * time.Second}

// remaining helper functions removed: detailed capability parsing now lives in
// shared scanners.

// scanUSBCameras looks for USB cameras that might need initialization
func (dp *DeviceProxy) scanUSBCameras() {
	// Check for USB video devices
	cmd := exec.Command("lsusb")
	output, err := cmd.Output()
	if err != nil {
		return
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		l := strings.TrimSpace(line)
		lower := strings.ToLower(l)
		if lower == "" {
			continue
		}
		if strings.Contains(lower, "camera") ||
			strings.Contains(lower, "video") ||
			strings.Contains(lower, "webcam") {
			if _, seen := dp.usbSeen[l]; !seen {
				logx.L.Info("found usb camera", "path", l)
				dp.usbSeen[l] = struct{}{}
			}
		}
	}
}

// registerWithDaemon posts local device metadata to the capture-daemon.
func (dp *DeviceProxy) registerWithDaemon(ctx context.Context) error {
	if dp.daemonURL == "" {
		return nil
	}

	hostname, _ := os.Hostname()
	dp.mutex.RLock()
	var devs []*DeviceInfo
	for _, d := range dp.devices {
		if !strings.HasPrefix(d.Path, "daemon:") {
			devs = append(devs, d)
		}
	}
	dp.mutex.RUnlock()

	payload := map[string]any{
		"proxy_id": hostname,
		"devices":  devs,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dp.daemonURL+"/register", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if dp.daemonToken != "" {
		req.Header.Set("Authorization", "Bearer "+dp.daemonToken)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	return nil
}

// negotiateWithDaemon performs the SDP offer/answer exchange.
func (dp *DeviceProxy) negotiateWithDaemon(pc *webrtc.PeerConnection) error {
	if _, err := pc.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo); err != nil {
		return err
	}
	offer, err := pc.CreateOffer(nil)
	if err != nil {
		return err
	}
	gather := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		return err
	}
	<-gather
	body, err := json.Marshal(map[string]any{"sdp": pc.LocalDescription()})
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, dp.daemonURL+"/webrtc/offer", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if dp.daemonToken != "" {
		req.Header.Set("Authorization", "Bearer "+dp.daemonToken)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req = req.WithContext(ctx)
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var ans struct {
		SDP webrtc.SessionDescription `json:"sdp"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ans); err != nil {
		return err
	}
	return pc.SetRemoteDescription(ans.SDP)
}

// streamFromFFmpeg launches ffmpeg and forwards H264 samples to track.
func (dp *DeviceProxy) streamFromFFmpeg(ctx context.Context, device string, track *webrtc.TrackLocalStaticSample) error {
	args := append(hwAccelArgs(), "-f", "v4l2", "-i", device,
		"-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
		"-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
		"-f", "h264", "pipe:1")
	cmd := ffmpegCmd(ctx, "ffmpeg", args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	buf := make([]byte, 1<<20)
	frameDur := time.Second / 15
	for {
		n, err := stdout.Read(buf)
		if err != nil {
			if err == io.EOF || ctx.Err() != nil {
				return nil
			}
			return err
		}
		data := make([]byte, n)
		copy(data, buf[:n])
		_ = track.WriteSample(media.Sample{Data: data, Duration: frameDur, Timestamp: dp.clock.Now()})
	}
}

// streamWebRTC starts a WebRTC relay to the capture-daemon.
func (dp *DeviceProxy) streamWebRTC(ctx context.Context, device string) error {
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{ICEServers: iceServers()})
	if err != nil {
		return err
	}
	track, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
		"video", "camera-proxy",
	)
	if err != nil {
		return err
	}
	if _, err = pc.AddTrack(track); err != nil {
		return err
	}
	if err := dp.negotiateWithDaemon(pc); err != nil {
		return err
	}
	go func() {
		_ = dp.streamFromFFmpeg(ctx, device, track)
		pc.Close()
	}()
	return nil
}

// createReverseProxy creates a reverse proxy to the backend service
func (dp *DeviceProxy) createReverseProxy(target *url.URL) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		origHost := req.Host
		originalDirector(req)
		req.Header.Set("X-Forwarded-Host", origHost)
		req.Header.Set("X-Forwarded-Proto", getEnv("FORWARDED_PROTO", "http"))
		req.Header.Set("X-Forwarded-For", req.RemoteAddr)
		req.Header.Set("X-Device-Proxy", "true")
	}
	return proxy
}

// enhanceDeviceResponse modifies backend responses to include discovered devices
func (dp *DeviceProxy) enhanceDeviceResponse(w http.ResponseWriter, r *http.Request) {
	// Check if this is a device list request
	if strings.Contains(r.URL.Path, "devices") || strings.Contains(r.URL.Path, "camera") {
		dp.mutex.RLock()
		devices := make([]*DeviceInfo, 0, len(dp.devices))
		for _, device := range dp.devices {
			devices = append(devices, device)
		}
		dp.mutex.RUnlock()

		// If it's a JSON API request, return our device list
		if strings.Contains(r.Header.Get("Accept"), "application/json") {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"devices": devices,
				"count":   len(devices),
			})
			return
		}
	}

	// For other requests, proxy to backend
	proxy := dp.createReverseProxy(dp.backendURL)
	proxy.ServeHTTP(w, r)
}

// handleDeviceStream creates virtual device streams
func (dp *DeviceProxy) handleDeviceStream(w http.ResponseWriter, r *http.Request) {
	devicePath := r.URL.Query().Get("device")
	if devicePath == "" {
		http.Error(w, "device parameter required", http.StatusBadRequest)
		return
	}

	dp.mutex.RLock()
	device, exists := dp.devices[devicePath]
	dp.mutex.RUnlock()

	if !exists || !device.IsAvailable {
		http.Error(w, "device not available", http.StatusNotFound)
		return
	}

	if strings.HasPrefix(devicePath, "daemon:") {
		raw := strings.TrimPrefix(devicePath, "daemon:")
		target := fmt.Sprintf("%s/preview/%s/index.m3u8", dp.daemonURL, url.PathEscape(filepath.Base(raw)))
		http.Redirect(w, r, target, http.StatusTemporaryRedirect)
		return
	}

	// Try WebRTC relay first
	if err := dp.streamWebRTC(r.Context(), devicePath); err == nil {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "webrtc"})
		return
	}

	// Fallback to MJPEG stream
	const boundary = "frame"
	w.Header().Set("Content-Type", "multipart/x-mixed-replace; boundary="+boundary)
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "close")

	args := append(hwAccelArgs(), "-f", "v4l2", "-i", devicePath,
		"-vf", "scale=640:480", "-r", "15", "-f", "mjpeg", "-q:v", "5", "pipe:1")
	cmd := ffmpegCmd(r.Context(), "ffmpeg", args...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, "failed to create stream", http.StatusInternalServerError)
		return
	}

	if err := cmd.Start(); err != nil {
		http.Error(w, "failed to start stream", http.StatusInternalServerError)
		return
	}

	defer func() {
		cmd.Process.Kill()
		cmd.Wait()
	}()

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	buffer := make([]byte, 4096)
	for {
		n, err := stdout.Read(buffer)
		if err != nil {
			if err != io.EOF {
				logx.L.Error("stream read error", "err", err)
			}
			break
		}

		io.WriteString(w, "--"+boundary+"\r\n")
		io.WriteString(w, "Content-Type: image/jpeg\r\n")
		io.WriteString(w, fmt.Sprintf("X-Timestamp: %s\r\n", dp.clock.Now().Format(time.RFC3339Nano)))
		io.WriteString(w, fmt.Sprintf("Content-Length: %d\r\n\r\n", n))
		if _, err := w.Write(buffer[:n]); err != nil {
			break
		}
		io.WriteString(w, "\r\n")
		flusher.Flush()

		select {
		case <-r.Context().Done():
			return
		default:
		}
	}
}

// handleWebSocketProxy proxies WebSocket connections with device enhancement
func (dp *DeviceProxy) handleWebSocketProxy(w http.ResponseWriter, r *http.Request) {
	// Upgrade connection
	clientConn, err := dp.upgrader.Upgrade(w, r, nil)
	if err != nil {
		logx.L.Error("websocket upgrade failed", "err", err)
		return
	}
	defer clientConn.Close()

	// Connect to backend WebSocket
	backendURL := dp.backendURL.String()
	backendURL = strings.Replace(backendURL, "http://", "ws://", 1)
	backendURL = strings.Replace(backendURL, "https://", "wss://", 1)
	backendURL += r.URL.Path

	backendConn, _, err := websocket.DefaultDialer.Dial(backendURL, nil)
	if err != nil {
		logx.L.Error("backend websocket connection failed", "err", err)
		return
	}
	defer backendConn.Close()

	// Proxy messages bidirectionally
	go dp.proxyWebSocketMessages(clientConn, backendConn, "client->backend")
	dp.proxyWebSocketMessages(backendConn, clientConn, "backend->client")
}

// proxyWebSocketMessages proxies WebSocket messages between connections
func (dp *DeviceProxy) proxyWebSocketMessages(from, to *websocket.Conn, direction string) {
	for {
		messageType, data, err := from.ReadMessage()
		if err != nil {
			logx.L.Error("websocket read error", "direction", direction, "err", err)
			break
		}

		// Enhance device-related messages
		if direction == "backend->client" {
			data = dp.enhanceWebSocketMessage(data)
		}

		if err := to.WriteMessage(messageType, data); err != nil {
			logx.L.Error("websocket write error", "direction", direction, "err", err)
			break
		}
	}
}

// enhanceWebSocketMessage enhances WebSocket messages with device information
func (dp *DeviceProxy) enhanceWebSocketMessage(data []byte) []byte {
	var message map[string]interface{}
	if err := json.Unmarshal(data, &message); err != nil {
		return data // Return original if not JSON
	}

	// Check if this is a device list response
	if action, ok := message["action"].(string); ok && strings.Contains(action, "device") {
		dp.mutex.RLock()
		devices := make([]*DeviceInfo, 0, len(dp.devices))
		for _, device := range dp.devices {
			devices = append(devices, device)
		}
		dp.mutex.RUnlock()

		message["data"] = devices
		if enhanced, err := json.Marshal(message); err == nil {
			return enhanced
		}
	}

	return data
}

// startPeriodicDiscovery runs device discovery periodically
func (dp *DeviceProxy) startPeriodicDiscovery(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	if err := dp.discoverDevices(); err != nil {
		logx.L.Error("initial device discovery failed", "err", err)
	} else {
		_ = dp.registerWithDaemon(ctx)
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := dp.discoverDevices(); err != nil {
				logx.L.Error("device discovery failed", "err", err)
			} else {
				_ = dp.registerWithDaemon(ctx)
			}
		}
	}
}

// handleDebugV4L2 exposes the last V4L2 discovery result.
//
// Example:
//
//	curl http://localhost:8000/debug/v4l2
func (dp *DeviceProxy) handleDebugV4L2(w http.ResponseWriter, r *http.Request) {
	dp.mutex.RLock()
	out := struct {
		Kept    []v4l2probe.Device `json:"kept"`
		Dropped []v4l2probe.Device `json:"dropped"`
	}{Kept: dp.probeKept, Dropped: dp.probeDropped}
	dp.mutex.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(out); err != nil {
		http.Error(w, "encode failed", http.StatusInternalServerError)
	}
}

// setupRoutes configures the proxy routes
func (dp *DeviceProxy) setupRoutes() *http.ServeMux {
	mux := http.NewServeMux()

	// Health endpoints
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		io.WriteString(w, "ok")
	})
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		io.WriteString(w, "ok")
	})

	// Device stream endpoint (transparent to containers)
	mux.HandleFunc("/stream/", dp.handleDeviceStream)

	// WebSocket proxy for control messages
	mux.HandleFunc("/ws/", dp.handleWebSocketProxy)

	// Enhanced device API endpoints
	mux.HandleFunc("/api/devices", dp.enhanceDeviceResponse)
	mux.HandleFunc("/devices", dp.enhanceDeviceResponse)

	// Debug endpoint for V4L2 discovery
	mux.HandleFunc("/debug/v4l2", dp.handleDebugV4L2)

	// Serve embedded viewer static files
	viewerDir := getEnv("VIEWER_DIR", "/srv/viewer")
	fs := http.FileServer(http.Dir(viewerDir))
	mux.Handle("/viewer/", http.StripPrefix("/viewer/", fs))

	// Default proxy to backend for all other requests
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		proxy := dp.createReverseProxy(dp.backendURL)
		proxy.ServeHTTP(w, r)
	})

	return mux
}

func main() {
	logx.Init(logx.Config{
		Service: "camera-proxy",
		Version: version,
		Level:   getEnv("LOG_LEVEL", "info"),
		Format:  getEnv("LOG_FORMAT", "auto"),
		Caller:  getEnv("LOG_CALLER", "short"),
		Time:    getEnv("LOG_TIME", "rfc3339ms"),
		NoColor: os.Getenv("LOG_NO_COLOR") == "1",
	})

	busamqp.Register()
	if _, err := bus.Connect(context.Background(), bus.Config{}); err != nil {
		logx.L.Warn("bus connect failed", "err", err)
	}
	defer bus.Close()

	// Configuration from environment variables
	proxyPort := getEnv("PROXY_PORT", "8000")
	backendAddr := getEnv("BACKEND_URL", "http://api-gateway:8080")
	frontendAddr := getEnv("FRONTEND_URL", "http://localhost:3000")

	// Create device proxy
	clock := ptp.New()
	proxy, err := NewDeviceProxy(backendAddr, frontendAddr, clock)
	if err != nil {
		logx.L.Error("failed to create device proxy", "err", err)
		os.Exit(1)
	}

	// Start device discovery
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go proxy.startPeriodicDiscovery(ctx)
	startOverlay(ctx)

	// Setup routes
	handler := proxy.setupRoutes()

	// Start proxy server
	logx.L.Info("service starting", "port", proxyPort)
	logx.L.Info("proxying to backend", "backend", backendAddr)
	logx.L.Info("serving frontend", "frontend", frontendAddr)

	server := &http.Server{
		Addr:    ":" + proxyPort,
		Handler: handler,
	}
	cert := getEnv("TLS_CERT_FILE", "")
	key := getEnv("TLS_KEY_FILE", "")
	if cert != "" && key != "" {
		if err := server.ListenAndServeTLS(cert, key); err != nil {
			logx.L.Error("server failed", "err", err)
			os.Exit(1)
		}
	}
	if err := server.ListenAndServe(); err != nil {
		logx.L.Error("server failed", "err", err)
		os.Exit(1)
	}
}

// getEnv gets environment variable with default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
