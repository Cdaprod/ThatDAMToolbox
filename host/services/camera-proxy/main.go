// Package main starts the camera-proxy service.
//
// The proxy discovers local camera devices and relays them to a capture-daemon
// using WebRTC. If negotiation with the daemon fails the proxy falls back to
// serving an MJPEG stream directly.
//
// Environment variables:
//
//	PROXY_PORT          – listening port (default 8000)
//	BACKEND_URL         – backend address to proxy (default http://localhost:8080)
//	FRONTEND_URL        – frontend address to proxy (default http://localhost:3000)
//	CAPTURE_DAEMON_URL  – optional capture-daemon address
//
// Example:
//
//	PROXY_PORT=8000 BACKEND_URL=http://localhost:8080 \
//	FRONTEND_URL=http://localhost:3000 CAPTURE_DAEMON_URL=http://localhost:9000 \
//	./camera-proxy
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
)

// DeviceInfo represents camera device information
type DeviceInfo struct {
	Path         string                 `json:"path"`
	Name         string                 `json:"name"`
	IsAvailable  bool                   `json:"is_available"`
	Capabilities map[string]interface{} `json:"capabilities,omitempty"`
}

// DeviceProxy manages camera device virtualization and proxying
type DeviceProxy struct {
	devices       map[string]*DeviceInfo
	mutex         sync.RWMutex
	backendURL    *url.URL
	frontendURL   *url.URL
	upgrader      websocket.Upgrader
	deviceStreams map[string]*exec.Cmd
	daemonURL     string
}

// NewDeviceProxy creates a new transparent device proxy
func NewDeviceProxy(backendAddr, frontendAddr string) (*DeviceProxy, error) {
	backendURL, err := url.Parse(backendAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid backend URL: %v", err)
	}

	frontendURL, err := url.Parse(frontendAddr)
	if err != nil {
		return nil, fmt.Errorf("invalid frontend URL: %v", err)
	}

	return &DeviceProxy{
		devices:       make(map[string]*DeviceInfo),
		backendURL:    backendURL,
		frontendURL:   frontendURL,
		deviceStreams: make(map[string]*exec.Cmd),
		daemonURL:     getEnv("CAPTURE_DAEMON_URL", "http://localhost:9000"),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}, nil
}

// discoverDevices scans for camera devices and creates virtual device mappings
func (dp *DeviceProxy) discoverDevices() error {
	dp.mutex.Lock()
	defer dp.mutex.Unlock()

	// Clear existing devices
	dp.devices = make(map[string]*DeviceInfo)

	// Scan for V4L2 devices
	pattern := "/dev/video*"
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return fmt.Errorf("failed to scan devices: %v", err)
	}

	for _, devicePath := range matches {
		if info, err := dp.getDeviceInfo(devicePath); err == nil {
			dp.devices[devicePath] = info
			log.Printf("Discovered device: %s (%s)", info.Name, info.Path)
		}
	}

	// Also scan for USB cameras that might not be mounted
	dp.scanUSBCameras()

	// ─── Merge devices from capture-daemon ─────────────
	if dp.daemonURL != "" {
		client := &http.Client{Timeout: 4 * time.Second}
		resp, err := client.Get(dp.daemonURL + "/devices")
		if err == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			var daemonDevs []map[string]interface{}
			if json.NewDecoder(resp.Body).Decode(&daemonDevs) == nil {
				for _, d := range daemonDevs {
					id, _ := d["id"].(string)
					name, _ := d["name"].(string)
					if id == "" {
						continue
					}
					key := "daemon:" + id
					dp.devices[key] = &DeviceInfo{
						Path:        key,
						Name:        name,
						IsAvailable: true,
						Capabilities: map[string]interface{}{
							"source":  "capture-daemon",
							"rawPath": id,
						},
					}
				}
			}
		}
	}

	return nil
}

// getDeviceInfo retrieves detailed information about a camera device
func (dp *DeviceProxy) getDeviceInfo(devicePath string) (*DeviceInfo, error) {
	// Check if device exists and is accessible
	if _, err := os.Stat(devicePath); err != nil {
		return nil, err
	}

	info := &DeviceInfo{
		Path:         devicePath,
		Name:         filepath.Base(devicePath),
		IsAvailable:  true,
		Capabilities: make(map[string]interface{}),
	}

	// Get device capabilities using v4l2-ctl
	if caps, err := dp.getV4L2Capabilities(devicePath); err == nil {
		info.Capabilities = caps
		// Extract a more friendly name if available
		if name, ok := caps["card"].(string); ok && name != "" {
			info.Name = name
		}
	}

	return info, nil
}

// getV4L2Capabilities gets device capabilities
func (dp *DeviceProxy) getV4L2Capabilities(devicePath string) (map[string]interface{}, error) {
	caps := make(map[string]interface{})

	// Get device info
	cmd := exec.Command("v4l2-ctl", "--device", devicePath, "--info")
	output, err := cmd.Output()
	if err != nil {
		return caps, err
	}

	// Parse v4l2-ctl output
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, ":") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(strings.ToLower(parts[0]))
				value := strings.TrimSpace(parts[1])
				caps[key] = value
			}
		}
	}

	// Get supported formats
	cmd = exec.Command("v4l2-ctl", "--device", devicePath, "--list-formats-ext")
	if output, err := cmd.Output(); err == nil {
		caps["formats"] = dp.parseFormats(string(output))
	}

	return caps, nil
}

// parseFormats parses v4l2-ctl format output
func (dp *DeviceProxy) parseFormats(output string) []map[string]interface{} {
	var formats []map[string]interface{}
	lines := strings.Split(output, "\n")

	var currentFormat map[string]interface{}
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "[") && strings.Contains(line, "]") {
			if currentFormat != nil {
				formats = append(formats, currentFormat)
			}
			currentFormat = make(map[string]interface{})
			// Extract format name
			if start := strings.Index(line, "]"); start != -1 {
				formatName := strings.TrimSpace(line[start+1:])
				if colon := strings.Index(formatName, ":"); colon != -1 {
					currentFormat["name"] = strings.TrimSpace(formatName[:colon])
					currentFormat["description"] = strings.TrimSpace(formatName[colon+1:])
				}
			}
		} else if strings.Contains(line, "Size:") && currentFormat != nil {
			// Parse resolution and frame rates
			currentFormat["resolutions"] = dp.parseResolutions(line)
		}
	}

	if currentFormat != nil {
		formats = append(formats, currentFormat)
	}

	return formats
}

// parseResolutions parses resolution information
func (dp *DeviceProxy) parseResolutions(line string) []string {
	var resolutions []string
	// Simple resolution parsing - can be enhanced
	if strings.Contains(line, "x") {
		parts := strings.Split(line, " ")
		for _, part := range parts {
			if strings.Contains(part, "x") && len(strings.Split(part, "x")) == 2 {
				resolutions = append(resolutions, part)
			}
		}
	}
	return resolutions
}

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
		if strings.Contains(strings.ToLower(line), "camera") ||
			strings.Contains(strings.ToLower(line), "video") ||
			strings.Contains(strings.ToLower(line), "webcam") {
			log.Printf("Found USB camera: %s", strings.TrimSpace(line))
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
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// negotiateWithDaemon performs the SDP offer/answer exchange.
func (dp *DeviceProxy) negotiateWithDaemon(pc *webrtc.PeerConnection) error {
	offer, err := pc.CreateOffer(nil)
	if err != nil {
		return err
	}
	if err := pc.SetLocalDescription(offer); err != nil {
		return err
	}
	body, err := json.Marshal(map[string]any{"sdp": offer})
	if err != nil {
		return err
	}
	resp, err := http.Post(dp.daemonURL+"/webrtc/offer", "application/json", bytes.NewReader(body))
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
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "v4l2",
		"-i", device,
		"-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
		"-f", "h264", "pipe:1",
	)
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
		_ = track.WriteSample(media.Sample{Data: data, Duration: frameDur})
	}
}

// streamWebRTC starts a WebRTC relay to the capture-daemon.
func (dp *DeviceProxy) streamWebRTC(ctx context.Context, device string) error {
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
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

	// Customize the director to modify requests
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
		req.Header.Set("X-Forwarded-Host", req.Host)
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
	w.Header().Set("Content-Type", "multipart/x-mixed-replace; boundary=frame")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "close")

	cmd := exec.Command("ffmpeg",
		"-f", "v4l2",
		"-i", devicePath,
		"-vf", "scale=640:480",
		"-r", "15",
		"-f", "mjpeg",
		"-q:v", "5",
		"pipe:1",
	)

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
				log.Printf("Stream read error: %v", err)
			}
			break
		}

		fmt.Fprintf(w, "\r\n--frame\r\n")
		fmt.Fprintf(w, "Content-Type: image/jpeg\r\n")
		fmt.Fprintf(w, "Content-Length: %d\r\n\r\n", n)
		w.Write(buffer[:n])
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
		log.Printf("WebSocket upgrade failed: %v", err)
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
		log.Printf("Backend WebSocket connection failed: %v", err)
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
			log.Printf("WebSocket read error (%s): %v", direction, err)
			break
		}

		// Enhance device-related messages
		if direction == "backend->client" {
			data = dp.enhanceWebSocketMessage(data)
		}

		if err := to.WriteMessage(messageType, data); err != nil {
			log.Printf("WebSocket write error (%s): %v", direction, err)
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
		log.Printf("Initial device discovery failed: %v", err)
	} else {
		_ = dp.registerWithDaemon(ctx)
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := dp.discoverDevices(); err != nil {
				log.Printf("Device discovery failed: %v", err)
			} else {
				_ = dp.registerWithDaemon(ctx)
			}
		}
	}
}

// setupRoutes configures the proxy routes
func (dp *DeviceProxy) setupRoutes() *http.ServeMux {
	mux := http.NewServeMux()

	// Device stream endpoint (transparent to containers)
	mux.HandleFunc("/stream/", dp.handleDeviceStream)

	// WebSocket proxy for control messages
	mux.HandleFunc("/ws/", dp.handleWebSocketProxy)

	// Enhanced device API endpoints
	mux.HandleFunc("/api/devices", dp.enhanceDeviceResponse)
	mux.HandleFunc("/devices", dp.enhanceDeviceResponse)

	// Default proxy to backend for all other requests
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		proxy := dp.createReverseProxy(dp.backendURL)
		proxy.ServeHTTP(w, r)
	})

	return mux
}

func main() {
	// Configuration from environment variables
	proxyPort := getEnv("PROXY_PORT", "8000")
	backendAddr := getEnv("BACKEND_URL", "http://localhost:8080")
	frontendAddr := getEnv("FRONTEND_URL", "http://localhost:3000")

	// Create device proxy
	proxy, err := NewDeviceProxy(backendAddr, frontendAddr)
	if err != nil {
		log.Fatalf("Failed to create device proxy: %v", err)
	}

	// Start device discovery
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go proxy.startPeriodicDiscovery(ctx)

	// Setup routes
	handler := proxy.setupRoutes()

	// Start proxy server
	log.Printf("Camera Device Proxy starting on port %s", proxyPort)
	log.Printf("Proxying to backend: %s", backendAddr)
	log.Printf("Serving frontend: %s", frontendAddr)

	server := &http.Server{
		Addr:    ":" + proxyPort,
		Handler: handler,
	}

	log.Fatal(server.ListenAndServe())
}

// getEnv gets environment variable with default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
