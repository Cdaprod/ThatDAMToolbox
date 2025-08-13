#!/bin/bash
# startup.sh - Single entry point for ThatDAM deployment
# This replaces manually running docker-compose.yaml

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"
DISCOVERY_SERVICE="thatdam-discovery"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yaml"
DISCOVERY_COMPOSE="${PROJECT_ROOT}/docker-compose.discovery.yaml"

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️  [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}❌ [ERROR]${NC} $1" >&2
}

log_banner() {
    echo -e "${PURPLE}"
    cat << 'EOF'
████████╗██╗  ██╗ █████╗ ████████╗██████╗  █████╗ ███╗   ███╗
╚══██╔══╝██║  ██║██╔══██╗╚══██╔══╝██╔══██╗██╔══██╗████╗ ████║
   ██║   ███████║███████║   ██║   ██║  ██║███████║██╔████╔██║
   ██║   ██╔══██║██╔══██║   ██║   ██║  ██║██╔══██║██║╚██╔╝██║
   ██║   ██║  ██║██║  ██║   ██║   ██████╔╝██║  ██║██║ ╚═╝ ██║
   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝

🚀 HYBRID CLOUD DISCOVERY STARTUP
🌐 Intelligent PaaS/IaaS/SaaS Deployment System
EOF
    echo -e "${NC}"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or not accessible"
        exit 1
    fi

    log_success "Docker is available"
}

# Check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose is not installed or not in PATH"
        exit 1
    fi

    log_success "docker-compose is available"
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."
    
    check_docker
    check_docker_compose
    
    # Check if we're on a supported architecture
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            log_info "Detected x86_64 architecture"
            ;;
        aarch64|arm64)
            log_info "Detected ARM64 architecture (e.g., Raspberry Pi)"
            ;;
        *)
            log_warning "Unsupported architecture: $ARCH (proceeding anyway)"
            ;;
    esac
    
    # Check available memory
    if [[ -f /proc/meminfo ]]; then
        MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        MEM_GB=$((MEM_KB / 1024 / 1024))
        if [[ $MEM_GB -lt 2 ]]; then
            log_warning "Low memory detected: ${MEM_GB}GB (recommend 4GB+)"
        else
            log_success "Memory: ${MEM_GB}GB"
        fi
    fi
}

# Build the discovery service if needed
build_discovery_service() {
    log_info "Building discovery service..."
    
    if ! docker image inspect "${DISCOVERY_SERVICE}:latest" &> /dev/null; then
        log_info "Discovery service image not found, building..."
        
        docker build -t "${DISCOVERY_SERVICE}:latest" \
            -f "${PROJECT_ROOT}/host/services/discovery/Dockerfile" \
            "${PROJECT_ROOT}"
        
        log_success "Discovery service built successfully"
    else
        log_info "Discovery service image already exists"
    fi
}

# Start the discovery service
start_discovery_service() {
    log_info "Starting discovery service..."
    
    # Stop any existing discovery service
    if docker ps -q -f name=thatdamtoolbox-discovery | grep -q .; then
        log_info "Stopping existing discovery service..."
        docker stop thatdamtoolbox-discovery || true
        docker rm thatdamtoolbox-discovery || true
    fi
    
    # Start the discovery service
    docker-compose -f "${DISCOVERY_COMPOSE}" up -d discovery
    
    # Wait for service to be ready
    log_info "Waiting for discovery service to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf http://localhost:9999/health &> /dev/null; then
            log_success "Discovery service is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    log_error "Discovery service failed to start within timeout"
    return 1
}

# Show discovery status
show_discovery_status() {
    log_info "Discovery service status:"
    
    if curl -sf http://localhost:9999/discovery &> /dev/null; then
        local status=$(curl -s http://localhost:9999/discovery)
        
        echo -e "${CYAN}📊 Discovery Information:${NC}"
        echo "$status" | jq '.' 2>/dev/null || echo "$status"
        
        # Extract mode from status
        local mode=$(echo "$status" | jq -r '.mode // "unknown"' 2>/dev/null)
        local node_id=$(echo "$status" | jq -r '.node_id // "unknown"' 2>/dev/null)
        local servers=$(echo "$status" | jq -r '.discovered_servers | length' 2>/dev/null)
        
        echo ""
        echo -e "${GREEN}🎯 Node ID:${NC} $node_id"
        echo -e "${GREEN}🔧 Mode:${NC} $mode"
        echo -e "${GREEN}🌐 Discovered Servers:${NC} $servers"
        
    else
        log_warning "Could not retrieve discovery status"
    fi
}

# Monitor services
monitor_services() {
    log_info "Monitoring services (Ctrl+C to stop)..."
    
    while true; do
        echo ""
        echo -e "${PURPLE}📈 Service Status - $(date)${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Show Docker containers
        echo -e "${CYAN}🐳 Docker Containers:${NC}"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep thatdamtoolbox || echo "No containers running"
        
        echo ""
        
        # Show discovery status
        if curl -sf http://localhost:9999/health &> /dev/null; then
            echo -e "${GREEN}🔍 Discovery Service: HEALTHY${NC}"
            
            # Get current mode
            local discovery_info=$(curl -s http://localhost:9999/discovery 2>/dev/null)
            if [[ -n "$discovery_info" ]]; then
                local mode=$(echo "$discovery_info" | jq -r '.mode // "unknown"' 2>/dev/null)
                local servers=$(echo "$discovery_info" | jq -r '.discovered_servers | length' 2>/dev/null)
                echo -e "   Mode: ${YELLOW}$mode${NC} | Servers: ${YELLOW}$servers${NC}"
            fi
        else
            echo -e "${RED}🔍 Discovery Service: DOWN${NC}"
        fi
        
        sleep 30
    done
}

# Stop all services
stop_services() {
    log_info "Stopping all services..."
    
    # Stop main services
    docker-compose -f "${COMPOSE_FILE}" down || true
    
    # Stop discovery service
    docker-compose -f "${DISCOVERY_COMPOSE}" down || true
    
    log_success "All services stopped"
}

# Clean up everything
cleanup() {
    log_info "Cleaning up..."
    
    stop_services
    
    # Remove volumes if requested
    if [[ "${CLEAN_VOLUMES:-false}" == "true" ]]; then
        log_warning "Removing volumes (data will be lost)..."
        docker-compose -f "${COMPOSE_FILE}" down -v || true
        docker-compose -f "${DISCOVERY_COMPOSE}" down -v || true
    fi
    
    # Remove networks
    docker network rm thatdamtoolbox_damnet 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Show help
show_help() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Commands:
  start     Start the discovery service and let it manage the stack
  stop      Stop all services
  status    Show current service status
  monitor   Monitor services in real-time
  cleanup   Stop and remove all containers/networks
  logs      Show discovery service logs
  help      Show this help message

Options:
  --discovery-backend=BACKEND  Set discovery backend (auto, mdns, serf, tailscale)
  --serf-join=ADDRESS         Join existing Serf cluster
  --clean-volumes            Remove volumes during cleanup (DESTRUCTIVE)

Environment Variables:
  DISCOVERY_BACKEND    Discovery backend preference (default: auto)
  SERF_JOIN           Serf cluster join address
  TAILSCALE_AUTHKEY   Tailscale authentication key
  LOG_LEVEL           Logging level (debug, info, warn, error)

Examples:
  $0 start                                    # Start with auto-discovery
  $0 start --discovery-backend=mdns          # Force mDNS discovery
  $0 start --serf-join=192.168.1.100:7946   # Join Serf cluster
  $0 monitor                                 # Watch services
  $0 cleanup --clean-volumes                 # Full cleanup

EOF
}

# Parse command line arguments
parse_args() {
    COMMAND=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            start|stop|status|monitor|cleanup|logs|help)
                COMMAND="$1"
                shift
                ;;
            --discovery-backend=*)
                export DISCOVERY_BACKEND="${1#*=}"
                shift
                ;;
            --serf-join=*)
                export SERF_JOIN="${1#*=}"
                shift
                ;;
            --clean-volumes)
                export CLEAN_VOLUMES="true"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    if [[ -z "$COMMAND" ]]; then
        COMMAND="start"
    fi
}

# Main execution
main() {
    log_banner
    
    parse_args "$@"
    
    case "$COMMAND" in
        start)
            check_requirements
            build_discovery_service
            start_discovery_service
            echo ""
            show_discovery_status
            echo ""
            log_success "ThatDAM system is starting up!"
            log_info "Use '$0 monitor' to watch services"
            log_info "Use '$0 status' to check current status"
            ;;
        
        stop)
            stop_services
            ;;
        
        status)
            show_discovery_status
            echo ""
            echo -e "${CYAN}🐳 Container Status:${NC}"
            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep thatdamtoolbox || echo "No containers running"
            ;;
        
        monitor)
            monitor_services
            ;;
        
        cleanup)
            cleanup
            ;;
        
        logs)
            log_info "Showing discovery service logs (Ctrl+C to exit):"
            docker logs -f thatdamtoolbox-discovery 2>/dev/null || log_error "Discovery service not running"
            ;;
        
        help)
            show_help
            ;;
        
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Trap signals for cleanup
trap 'log_info "Received interrupt signal"; exit 0' INT TERM

# Run main function with all arguments
main "$@"