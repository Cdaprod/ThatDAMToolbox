package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/hashicorp/serf/serf"
	"github.com/miekg/dns"
	"github.com/pion/mdns"
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
	DiscoveryMDNS   = "mdns"
	DiscoverySerf   = "serf"
	DiscoveryTailscale = "tailscale"
)

type ServiceInfo struct {
	Host     string    `json:"host"`
	Port     int       `json:"port"`
	NodeID   string    `json:"node_id"`
	Mode     string    `json:"mode"`
	LastSeen time.Time `json:"last_seen"`
}

type DiscoveryManager struct {
	nodeID       string
	mode         string
	serviceInfo  ServiceInfo
	discoveredServers map[string]ServiceInfo
	mutex        sync.RWMutex
	ctx          context.Context
	cancel       context.CancelFunc
	
	// Discovery backends
	serfAgent    *serf.Serf
	mdnsServer   *mdns.Server
	
	// Health check server
	healthServer *http.Server
}

func NewDiscoveryManager() *DiscoveryManager {
	ctx, cancel := context.WithCancel(context.Background())
	
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

func (dm *DiscoveryManager) Start() error {
	printBanner()
	
	log.Printf("🚀 Starting ThatDAM Hybrid Discovery Service")
	log.Printf("📡 Node ID: %s", dm.nodeID)
	
	// Start health check server first
	if err := dm.startHealthServer(); err != nil {
		return fmt.Errorf("failed to start health server: %w", err)
	}
	
	// Determine discovery backend based on environment
	backend := dm.detectDiscoveryBackend()
	log.Printf("🔍 Using discovery backend: %s", backend)
	
	// Start discovery based on backend
	switch backend {
	case DiscoveryTailscale:
		if err := dm.startTailscaleDiscovery(); err != nil {
			log.Printf("⚠️  Tailscale discovery failed, falling back to mDNS: %v", err)
			backend = DiscoveryMDNS
		}
	case DiscoverySerf:
		if err := dm.startSerfDiscovery(); err != nil {
			log.Printf("⚠️  Serf discovery failed, falling back to mDNS: %v", err)
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
		log.Printf("🏥 Health server listening on :%d", HealthCheckPort)
		if err := dm.healthServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("❌ Health server error: %v", err)
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
		"mode":              dm.mode,
		"discovered_servers": dm.discoveredServers,
		"service_info":       dm.serviceInfo,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (dm *DiscoveryManager) startMDNSDiscovery() error {
	log.Printf("🔍 Starting mDNS discovery...")
	
	// Start mDNS browser
	go dm.browseMDNS()
	
	// Small delay to discover existing services
	time.Sleep(2 * time.Second)
	
	return nil
}

func (dm *DiscoveryManager) browseMDNS() {
	resolver, err := mdns.NewResolver(nil)
	if err != nil {
		log.Printf("❌ Failed to create mDNS resolver: %v", err)
		return
	}
	defer resolver.Close()
	
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
			
			log.Printf("🎯 Discovered mDNS service: %s:%d (Node: %s)", entry.Host, entry.Port, entry.Info)
		}
	}()
	
	// Continuous discovery
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
	log.Printf("🔍 Starting Serf discovery...")
	
	config := serf.DefaultConfig()
	config.NodeName = dm.nodeID
	config.MemberlistConfig.BindPort = 7946
	
	// Custom event handler
	config.EventCh = make(chan serf.Event, 64)
	
	var err error
	dm.serfAgent, err = serf.Create(config)
	if err != nil {
		return fmt.Errorf("failed to create serf agent: %w", err)
	}
	
	// Handle events
	go dm.handleSerfEvents()
	
	// Join existing cluster if specified
	if joinAddr := os.Getenv("SERF_JOIN"); joinAddr != "" {
		_, err = dm.serfAgent.Join([]string{joinAddr}, true)
		if err != nil {
			log.Printf("⚠️  Failed to join Serf cluster at %s: %v", joinAddr, err)
		} else {
			log.Printf("🤝 Joined Serf cluster via %s", joinAddr)
		}
	}
	
	return nil
}

func (dm *DiscoveryManager) handleSerfEvents() {
	for event := range dm.serfAgent.EventCh() {
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
					
					log.Printf("🎯 Discovered Serf member: %s (%s)", member.Name, member.Addr)
				}
			}
		}
	}
}

func (dm *DiscoveryManager) startTailscaleDiscovery() error {
	log.Printf("🔍 Starting Tailscale discovery...")
	
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
		
		log.Printf("🎯 Discovered Tailscale peer: %s (%s)", nodeID, dnsName)
	}
}

func (dm *DiscoveryManager) decideMode() {
	dm.mutex.RLock()
	serverCount := len(dm.discoveredServers)
	dm.mutex.RUnlock()
	
	if serverCount == 0 {
		dm.mode = ModeServer
		log.Printf("👑 No existing servers found - becoming SERVER")
		
		// Start advertising our service
		dm.advertiseService()
	} else {
		dm.mode = ModeProxy
		log.Printf("📹 Found %d existing server(s) - becoming CAMERA-PROXY", serverCount)
		
		// Display discovered servers
		dm.mutex.RLock()
		for nodeID, info := range dm.discoveredServers {
			log.Printf("   → %s at %s:%d", nodeID, info.Host, info.Port)
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
		log.Printf("❌ Failed to create mDNS service: %v", err)
		return
	}
	
	dm.mdnsServer, err = mdns.NewServer(&mdns.Config{Zone: service})
	if err != nil {
		log.Printf("❌ Failed to start mDNS server: %v", err)
		return
	}
	
	log.Printf("📡 Advertising mDNS service: %s", ServiceName)
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
		log.Printf("❌ Failed to send Serf leadership event: %v", err)
	} else {
		log.Printf("📡 Announced Serf leadership")
	}
}

func (dm *DiscoveryManager) startServices() error {
	switch dm.mode {
	case ModeServer:
		return dm.startServerMode()
	case ModeProxy:
		return dm.startProxyMode()
	default:
		return fmt.Errorf("unknown mode: %s", dm.mode)
	}
}

func (dm *DiscoveryManager) startServerMode() error {
	log.Printf("🚀 Starting SERVER mode - launching full infrastructure...")
	
	// Launch docker-compose with server profile
	cmd := exec.Command("docker-compose", 
		"-f", "docker-compose.yaml",
		"--profile", "server",
		"up", "-d",
		"capture-daemon", "rabbitmq", "video-api", "video-web", "gw")
	
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to start server services: %w", err)
	}
	
	log.Printf("✅ Server infrastructure started successfully")
	
	// Monitor services
	go dm.monitorServerServices()
	
	return nil
}

func (dm *DiscoveryManager) startProxyMode() error {
	log.Printf("🚀 Starting CAMERA-PROXY mode...")
	
	// Select a server to connect to
	var targetServer ServiceInfo
	dm.mutex.RLock()
	for _, server := range dm.discoveredServers {
		targetServer = server
		break // Use first available server
	}
	dm.mutex.RUnlock()
	
	if targetServer.NodeID == "" {
		return fmt.Errorf("no server available for proxy connection")
	}
	
	log.Printf("🎯 Connecting to server: %s (%s:%d)", targetServer.NodeID, targetServer.Host, targetServer.Port)
	
	// Set environment variables for proxy
	os.Setenv("CAPTURE_DAEMON_URL", fmt.Sprintf("http://%s:%d", targetServer.Host, targetServer.Port))
	os.Setenv("EVENT_BROKER_URL", fmt.Sprintf("amqp://video:video@%s:5672/", targetServer.Host))
	
	// Launch camera-proxy
	cmd := exec.Command("docker-compose", 
		"-f", "docker-compose.yaml",
		"up", "-d", "camera-proxy")
	
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to start camera-proxy: %w", err)
	}
	
	log.Printf("✅ Camera proxy started successfully")
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
			log.Printf("💓 Server heartbeat - monitoring %d services", len(dm.discoveredServers))
		}
	}
}

func (dm *DiscoveryManager) Stop() {
	log.Printf("🛑 Shutting down discovery service...")
	
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

func main() {
	dm := NewDiscoveryManager()
	
	// Graceful shutdown handling
	go func() {
		// In a real implementation, you'd handle SIGINT/SIGTERM here
		time.Sleep(time.Hour) // Placeholder - run for an hour
		dm.Stop()
	}()
	
	if err := dm.Start(); err != nil {
		log.Fatalf("❌ Failed to start discovery service: %v", err)
	}
	
	// Keep running
	select {}
}