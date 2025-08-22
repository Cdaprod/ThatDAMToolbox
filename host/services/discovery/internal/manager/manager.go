package manager

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	supervisor "github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor"
	"github.com/hashicorp/mdns"
	"github.com/hashicorp/serf/serf"
)

const (
	// Service discovery constants
	ServiceName     = "_thatdam-server._tcp.local."
	ServicePort     = 8080
	HealthCheckPort = 9999

	// Deployment modes
	ModeServer = "server"
	ModeProxy  = "proxy"

	// Discovery backends
	DiscoveryMDNS      = "mdns"
	DiscoverySerf      = "serf"
	DiscoveryTailscale = "tailscale"
)

const Version = "dev"

type ServiceInfo struct {
	Host     string    `json:"host"`
	Port     int       `json:"port"`
	NodeID   string    `json:"node_id"`
	Mode     string    `json:"mode"`
	LastSeen time.Time `json:"last_seen"`
}

type DiscoveryManager struct {
	nodeID            string
	mode              string
	serviceInfo       ServiceInfo
	discoveredServers map[string]ServiceInfo
	mutex             sync.RWMutex
	ctx               context.Context
	cancel            context.CancelFunc

	// Discovery backends
	serfAgent   *serf.Serf
	serfEventCh chan serf.Event
	mdnsServer  *mdns.Server

	// Health check server
	healthServer *http.Server
}

func New() *DiscoveryManager {
	ctx, cancel := context.WithCancel(context.Background())

	silenceMDNSLogs()

	// Generate unique node ID
	hostname, _ := os.Hostname()
	nodeID := fmt.Sprintf("%s-%d", hostname, time.Now().Unix())

	dm := &DiscoveryManager{
		nodeID:            nodeID,
		discoveredServers: make(map[string]ServiceInfo),
		ctx:               ctx,
		cancel:            cancel,
	}

	return dm
}

// silenceMDNSLogs filters out noisy mdns client shutdown logs.
// Example:
//
//	silenceMDNSLogs()
//
// It ensures repeated mdns lookups don't spam standard log output.
func silenceMDNSLogs() {
	orig := log.Writer()
	log.SetOutput(&mdnsLogFilter{w: orig})
}

// mdnsLogFilter discards mdns client close messages while forwarding others.
type mdnsLogFilter struct {
	w io.Writer
}

func (f *mdnsLogFilter) Write(p []byte) (int, error) {
	if bytes.Contains(p, []byte("mdns: Closing client")) {
		return len(p), nil
	}
	return f.w.Write(p)
}

type leaderInfo struct {
	Host string
	Port int
}

// readLeaderFile parses a dotenv-style file for HOST and PORT values.
func readLeaderFile(path string) (leaderInfo, error) {
	f, err := os.Open(path)
	if err != nil {
		return leaderInfo{}, err
	}
	defer f.Close()

	var info leaderInfo
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "HOST=") {
			info.Host = strings.TrimPrefix(line, "HOST=")
		} else if strings.HasPrefix(line, "PORT=") {
			if p, err := strconv.Atoi(strings.TrimPrefix(line, "PORT=")); err == nil {
				info.Port = p
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return leaderInfo{}, err
	}
	if info.Host == "" || info.Port == 0 {
		return leaderInfo{}, fmt.Errorf("invalid leader file")
	}
	return info, nil
}

// composeCmd returns an exec.Cmd for docker-compose or 'docker compose'.
func composeCmd(args ...string) (*exec.Cmd, error) {
	if path, err := exec.LookPath("docker-compose"); err == nil {
		return exec.Command(path, args...), nil
	}
	if path, err := exec.LookPath("docker"); err == nil {
		return exec.Command(path, append([]string{"compose"}, args...)...), nil
	}
	return nil, fmt.Errorf("docker-compose: executable not found")
}

func (dm *DiscoveryManager) Start() error {
	printBanner()

	logx.L.Info("starting discovery service")
	logx.L.Info("node id", "id", dm.nodeID)

	// Start health check server first
	if err := dm.startHealthServer(); err != nil {
		return fmt.Errorf("failed to start health server: %w", err)
	}

	// Determine discovery backend based on environment
	backend := dm.detectDiscoveryBackend()
	logx.L.Info("using discovery backend", "backend", backend)

	// Start discovery based on backend
	switch backend {
	case DiscoveryTailscale:
		if err := dm.startTailscaleDiscovery(); err != nil {
			logx.L.Warn("tailscale discovery failed, falling back to mdns", "err", err)
			backend = DiscoveryMDNS
		}
	case DiscoverySerf:
		if err := dm.startSerfDiscovery(); err != nil {
			logx.L.Warn("serf discovery failed, falling back to mdns", "err", err)
			backend = DiscoveryMDNS
		}
	}

	if backend == DiscoveryMDNS {
		if err := dm.startMDNSDiscovery(); err != nil {
			return fmt.Errorf("all discovery backends failed: %w", err)
		}
	}

	// Wait for discovery and decide mode
	time.Sleep(5 * time.Second)
	dm.decideMode()

	// Start the appropriate services
	return dm.startServices()
}

func (dm *DiscoveryManager) detectDiscoveryBackend() string {
	// Check if we're in Tailscale network
	if dm.isTailscaleAvailable() {
		return DiscoveryTailscale
	}

	// Check for Serf environment
	if os.Getenv("SERF_JOIN") != "" || os.Getenv("DISCOVERY_BACKEND") == "serf" {
		return DiscoverySerf
	}

	// Default to mDNS for local network
	return DiscoveryMDNS
}

func (dm *DiscoveryManager) isTailscaleAvailable() bool {
	cmd := exec.Command("tailscale", "status", "--json")
	if err := cmd.Run(); err != nil {
		return false
	}
	return true
}

func (dm *DiscoveryManager) startHealthServer() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", dm.handleHealth)
	mux.HandleFunc("/discovery", dm.handleDiscovery)

	dm.healthServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", HealthCheckPort),
		Handler: mux,
	}

	go func() {
		logx.L.Info("health server listening", "port", HealthCheckPort)
		if err := dm.healthServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logx.L.Error("health server error", "err", err)
		}
	}()

	return nil
}

func (dm *DiscoveryManager) handleHealth(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"status":    "healthy",
		"node_id":   dm.nodeID,
		"mode":      dm.mode,
		"timestamp": time.Now().Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (dm *DiscoveryManager) handleDiscovery(w http.ResponseWriter, r *http.Request) {
	dm.mutex.RLock()
	defer dm.mutex.RUnlock()

	response := map[string]interface{}{
		"node_id":            dm.nodeID,
		"mode":               dm.mode,
		"discovered_servers": dm.discoveredServers,
		"service_info":       dm.serviceInfo,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (dm *DiscoveryManager) startMDNSDiscovery() error {
	logx.L.Info("starting mdns discovery")

	// Start mDNS browser
	go dm.browseMDNS()

	// Small delay to discover existing services
	time.Sleep(2 * time.Second)

	return nil
}

func (dm *DiscoveryManager) browseMDNS() {
	entries := make(chan *mdns.ServiceEntry, 4)
	go func() {
		for entry := range entries {
			dm.mutex.Lock()
			dm.discoveredServers[entry.Host] = ServiceInfo{
				Host:     entry.Host,
				Port:     entry.Port,
				NodeID:   entry.Info,
				Mode:     ModeServer,
				LastSeen: time.Now(),
			}
			dm.mutex.Unlock()

			logx.L.Info("discovered mdns service", "host", entry.Host, "port", entry.Port, "node", entry.Info)
		}
	}()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-dm.ctx.Done():
			return
		case <-ticker.C:
			mdns.Lookup(ServiceName, entries)
		}
	}
}

func (dm *DiscoveryManager) startSerfDiscovery() error {
	logx.L.Info("starting serf discovery")

	config := serf.DefaultConfig()
	config.NodeName = dm.nodeID
	config.MemberlistConfig.BindPort = 7946
	dm.serfEventCh = make(chan serf.Event, 64)
	config.EventCh = dm.serfEventCh

	var err error
	dm.serfAgent, err = serf.Create(config)
	if err != nil {
		return fmt.Errorf("failed to create serf agent: %w", err)
	}

	go dm.handleSerfEvents()

	// Join existing cluster if specified
	if joinAddr := os.Getenv("SERF_JOIN"); joinAddr != "" {
		_, err = dm.serfAgent.Join([]string{joinAddr}, true)
		if err != nil {
			logx.L.Warn("failed to join serf cluster", "addr", joinAddr, "err", err)
		} else {
			logx.L.Info("joined serf cluster", "addr", joinAddr)
		}
	}

	return nil
}

func (dm *DiscoveryManager) handleSerfEvents() {
	for event := range dm.serfEventCh {
		switch e := event.(type) {
		case serf.MemberEvent:
			for _, member := range e.Members {
				if member.Name != dm.nodeID {
					dm.mutex.Lock()
					dm.discoveredServers[member.Name] = ServiceInfo{
						Host:     member.Addr.String(),
						Port:     ServicePort,
						NodeID:   member.Name,
						Mode:     ModeServer, // Assume server for now
						LastSeen: time.Now(),
					}
					dm.mutex.Unlock()

					logx.L.Info("discovered serf member", "name", member.Name, "addr", member.Addr)
				}
			}
		}
	}
}

func (dm *DiscoveryManager) startTailscaleDiscovery() error {
	logx.L.Info("starting tailscale discovery")

	// Get Tailscale status
	cmd := exec.Command("tailscale", "status", "--json")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to get tailscale status: %w", err)
	}

	var status map[string]interface{}
	if err := json.Unmarshal(output, &status); err != nil {
		return fmt.Errorf("failed to parse tailscale status: %w", err)
	}

	// Parse peers and check for existing services
	if peers, ok := status["Peer"].(map[string]interface{}); ok {
		for _, peer := range peers {
			if peerInfo, ok := peer.(map[string]interface{}); ok {
				if dnsName, ok := peerInfo["DNSName"].(string); ok {
					// Check if this peer runs our service
					go dm.checkTailscalePeer(dnsName)
				}
			}
		}
	}

	return nil
}

func (dm *DiscoveryManager) checkTailscalePeer(dnsName string) {
	// Remove trailing dot from DNS name
	dnsName = strings.TrimSuffix(dnsName, ".")

	// Try to connect to health endpoint
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://%s:%d/health", dnsName, HealthCheckPort))
	if err != nil {
		return // Peer doesn't run our service
	}
	defer resp.Body.Close()

	var healthInfo map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&healthInfo); err != nil {
		return
	}

	if nodeID, ok := healthInfo["node_id"].(string); ok {
		dm.mutex.Lock()
		dm.discoveredServers[nodeID] = ServiceInfo{
			Host:     dnsName,
			Port:     ServicePort,
			NodeID:   nodeID,
			Mode:     ModeServer,
			LastSeen: time.Now(),
		}
		dm.mutex.Unlock()

		logx.L.Info("discovered tailscale peer", "id", nodeID, "dns", dnsName)
	}
}

func (dm *DiscoveryManager) decideMode() {
	dm.mutex.RLock()
	serverCount := len(dm.discoveredServers)
	dm.mutex.RUnlock()

	if serverCount == 0 {
		// Verify docker-compose availability before assuming server mode
		if cmd, err := composeCmd("--version"); err != nil {
			logx.L.Warn("docker-compose unavailable - defaulting to proxy mode", "err", err)
			dm.mode = ModeProxy
		} else if err = cmd.Run(); err != nil {
			logx.L.Warn("docker-compose check failed - defaulting to proxy mode", "err", err)
			dm.mode = ModeProxy
		} else {
			dm.mode = ModeServer
			logx.L.Info("no existing servers found - becoming server")
			dm.advertiseService()
		}
	} else {
		dm.mode = ModeProxy
		logx.L.Info("found existing servers - becoming camera-proxy", "count", serverCount)

		// Display discovered servers
		dm.mutex.RLock()
		for nodeID, info := range dm.discoveredServers {
			logx.L.Info("existing server", "id", nodeID, "host", info.Host, "port", info.Port)
		}
		dm.mutex.RUnlock()
	}

	// Update service info
	hostname, _ := os.Hostname()
	dm.serviceInfo = ServiceInfo{
		Host:     hostname,
		Port:     ServicePort,
		NodeID:   dm.nodeID,
		Mode:     dm.mode,
		LastSeen: time.Now(),
	}
}

func (dm *DiscoveryManager) advertiseService() {
	if dm.mode != ModeServer {
		return
	}

	// Advertise via mDNS
	go dm.advertiseMDNS()

	// Advertise via Serf if available
	if dm.serfAgent != nil {
		go dm.advertiseSerfLeadership()
	}
}

func (dm *DiscoveryManager) advertiseMDNS() {
	host, _ := os.Hostname()
	info := []string{dm.nodeID}

	service, err := mdns.NewMDNSService(host, ServiceName, "", "", ServicePort, nil, info)
	if err != nil {
		logx.L.Error("failed to create mdns service", "err", err)
		return
	}

	dm.mdnsServer, err = mdns.NewServer(&mdns.Config{Zone: service})
	if err != nil {
		logx.L.Error("failed to start mdns server", "err", err)
		return
	}

	logx.L.Info("advertising mdns service", "service", ServiceName)
}

func (dm *DiscoveryManager) advertiseSerfLeadership() {
	if dm.serfAgent == nil {
		return
	}

	// Send leadership event
	payload := map[string]string{
		"node_id": dm.nodeID,
		"role":    "leader",
		"port":    fmt.Sprintf("%d", ServicePort),
	}

	payloadBytes, _ := json.Marshal(payload)
	err := dm.serfAgent.UserEvent("leader-elected", payloadBytes, true)
	if err != nil {
		logx.L.Error("failed to send serf leadership event", "err", err)
	} else {
		logx.L.Info("announced serf leadership")
	}
}

func (dm *DiscoveryManager) startServices() error {
	switch dm.mode {
	case ModeServer:
		if err := dm.startServerMode(); err != nil {
			if strings.Contains(err.Error(), "docker-compose") {
				logx.L.Warn("server mode failed, falling back to proxy", "err", err)
				dm.mode = ModeProxy
				return dm.startProxyMode()
			}
			return err
		}
		return nil
	case ModeProxy:
		return dm.startProxyMode()
	default:
		return fmt.Errorf("unknown mode: %s", dm.mode)
	}
}

func (dm *DiscoveryManager) startServerMode() error {
	logx.L.Info("starting server mode")
	dp, err := supervisor.FetchPlan(dm.ctx, map[string]string{"node_id": dm.nodeID, "role_hint": "server"})
	if err != nil {
		return fmt.Errorf("fetch plan: %w", err)
	}
	a := NewApplier(dp.Executor)
	if err := a.Apply(dm.ctx, dp); err != nil {
		return fmt.Errorf("apply plan: %w", err)
	}
	return nil
}

func (dm *DiscoveryManager) startProxyMode() error {
	logx.L.Info("starting proxy mode")
	dp, err := supervisor.FetchPlan(dm.ctx, map[string]string{"node_id": dm.nodeID, "role_hint": "proxy"})
	if err != nil {
		return fmt.Errorf("fetch plan: %w", err)
	}
	a := NewApplier(dp.Executor)
	if err := a.Apply(dm.ctx, dp); err != nil {
		return fmt.Errorf("apply plan: %w", err)
	}
	return nil
}

func (dm *DiscoveryManager) monitorServerServices() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-dm.ctx.Done():
			return
		case <-ticker.C:
			logx.L.Info("server heartbeat", "services", len(dm.discoveredServers))
		}
	}
}

func (dm *DiscoveryManager) Stop() {
	logx.L.Info("shutting down discovery service")

	dm.cancel()

	if dm.mdnsServer != nil {
		dm.mdnsServer.Shutdown()
	}

	if dm.serfAgent != nil {
		dm.serfAgent.Leave()
		dm.serfAgent.Shutdown()
	}

	if dm.healthServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		dm.healthServer.Shutdown(ctx)
	}
}

func printBanner() {
	banner := `
██████╗  █████╗ ███╗   ███╗████████╗ ██████╗  ██████╗ ██╗     ██████╗  ██████╗ ██╗  ██╗
██╔══██╗██╔══██╗████╗ ████║╚══██╔══╝██╔═══██╗██╔═══██╗██║     ██╔══██╗██╔═══██╗╚██╗██╔╝
██║  ██║███████║██╔████╔██║   ██║   ██║   ██║██║   ██║██║     ██████╔╝██║   ██║ ╚███╔╝ 
██║  ██║██╔══██║██║╚██╔╝██║   ██║   ██║   ██║██║   ██║██║     ██╔══██╗██║   ██║ ██╔██╗ 
██████╔╝██║  ██║██║ ╚═╝ ██║   ██║   ╚██████╔╝╚██████╔╝███████╗██████╔╝╚██████╔╝██╔╝ ██╗
╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝

🎬 HYBRID CLOUD DISCOVERY SERVICE
🌐 Enterprise-grade auto-discovery for PaaS/IaaS/SaaS deployment
`
	fmt.Println(banner)
}
