#!/usr/bin/env python3
"""
Camera Rig WiFi Manager Daemon for Raspberry Pi 5
Communicates with ESP32 WT-SC032 via I2C to manage WiFi connections
"""

import json
import time
import logging
import subprocess
import os
import signal
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any
import smbus2
import threading
from pathlib import Path

# Configuration Constants
I2C_BUS = 1  # I2C bus number on Pi 5
ESP32_ADDRESS = 0x08  # ESP32 I2C address
POLL_INTERVAL = 10  # seconds
LOG_FILE = "/var/log/camerarig-setup.log"
WPA_SUPPLICANT_CONF = "/etc/wpa_supplicant/wpa_supplicant.conf"
STATUS_FILE = "/tmp/camerarig_status.json"

class WiFiManager:
    def __init__(self):
        self.bus = None
        self.logger = self._setup_logging()
        self.running = True
        self.current_status = {
            "status": "unknown",
            "ssid": "",
            "ip": "",
            "last_update": "",
            "error": "",
            "available_networks": []
        }
        
        # Initialize I2C
        self._init_i2c()
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger('CameraRigWiFi')
        logger.setLevel(logging.INFO)
        
        # Create log directory if it doesn't exist
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        
        # File handler
        file_handler = logging.FileHandler(LOG_FILE)
        file_handler.setLevel(logging.INFO)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        return logger
        
    def _init_i2c(self) -> None:
        """Initialize I2C bus connection"""
        try:
            self.bus = smbus2.SMBus(I2C_BUS)
            self.logger.info(f"I2C bus {I2C_BUS} initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize I2C bus: {e}")
            raise
            
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        self.logger.info(f"Received signal {signum}, shutting down...")
        self.running = False
        
    def send_command_to_esp32(self, command: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Send command to ESP32 and receive response"""
        try:
            # Send command
            cmd_json = json.dumps(command)
            cmd_bytes = cmd_json.encode('utf-8')
            
            # Write command to ESP32
            self.bus.write_i2c_block_data(ESP32_ADDRESS, 0, list(cmd_bytes))
            
            # Small delay to allow ESP32 to process
            time.sleep(0.1)
            
            # Read response
            response_bytes = self.bus.read_i2c_block_data(ESP32_ADDRESS, 0, 32)
            
            # Find actual end of data (remove null bytes)
            response_data = bytes([b for b in response_bytes if b != 0])
            
            if response_data:
                response_str = response_data.decode('utf-8')
                return json.loads(response_str)
            else:
                return {}
                
        except Exception as e:
            self.logger.error(f"I2C communication error: {e}")
            return None
            
    def get_current_wifi_status(self) -> Dict[str, str]:
        """Get current WiFi connection status from system"""
        try:
            # Get interface status
            result = subprocess.run(
                ['iwgetid', '-r'], 
                capture_output=True, 
                text=True, 
                timeout=5
            )
            
            if result.returncode == 0 and result.stdout.strip():
                ssid = result.stdout.strip()
                
                # Get IP address
                ip_result = subprocess.run(
                    ['hostname', '-I'], 
                    capture_output=True, 
                    text=True, 
                    timeout=5
                )
                
                ip = ip_result.stdout.strip().split()[0] if ip_result.returncode == 0 else ""
                
                return {
                    "status": "connected",
                    "ssid": ssid,
                    "ip": ip
                }
            else:
                return {
                    "status": "disconnected",
                    "ssid": "",
                    "ip": ""
                }
                
        except Exception as e:
            self.logger.error(f"Error getting WiFi status: {e}")
            return {
                "status": "error",
                "ssid": "",
                "ip": "",
                "error": str(e)
            }
            
    def update_wpa_supplicant(self, ssid: str, password: str) -> bool:
        """Update wpa_supplicant.conf with new network credentials"""
        try:
            # Backup current config
            backup_path = f"{WPA_SUPPLICANT_CONF}.backup.{int(time.time())}"
            subprocess.run(['sudo', 'cp', WPA_SUPPLICANT_CONF, backup_path], check=True)
            
            # Read current config
            with open(WPA_SUPPLICANT_CONF, 'r') as f:
                current_config = f.read()
                
            # Check if network already exists
            if f'ssid="{ssid}"' in current_config:
                self.logger.info(f"Network {ssid} already exists in config, updating...")
                # Remove existing network block
                lines = current_config.split('\n')
                new_lines = []
                skip_network = False
                
                for line in lines:
                    if line.strip().startswith('network={'):
                        skip_network = True
                        network_block = [line]
                    elif skip_network and line.strip() == '}':
                        network_block.append(line)
                        # Check if this network block contains our SSID
                        network_text = '\n'.join(network_block)
                        if f'ssid="{ssid}"' not in network_text:
                            new_lines.extend(network_block)
                        skip_network = False
                        network_block = []
                    elif skip_network:
                        network_block.append(line)
                    else:
                        new_lines.append(line)
                        
                current_config = '\n'.join(new_lines)
            
            # Add new network configuration
            network_config = f'''
network={{
    ssid="{ssid}"
    psk="{password}"
    key_mgmt=WPA-PSK
    priority=1
}}
'''
            
            updated_config = current_config.rstrip() + network_config
            
            # Write updated config
            temp_file = f"{WPA_SUPPLICANT_CONF}.tmp"
            with open(temp_file, 'w') as f:
                f.write(updated_config)
                
            # Move temp file to actual config (atomic operation)
            subprocess.run(['sudo', 'mv', temp_file, WPA_SUPPLICANT_CONF], check=True)
            
            # Set proper permissions
            subprocess.run(['sudo', 'chmod', '600', WPA_SUPPLICANT_CONF], check=True)
            subprocess.run(['sudo', 'chown', 'root:root', WPA_SUPPLICANT_CONF], check=True)
            
            # Restart wpa_supplicant to apply changes
            subprocess.run(['sudo', 'systemctl', 'restart', 'wpa_supplicant'], check=True)
            
            self.logger.info(f"Updated wpa_supplicant configuration for network: {ssid}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to update wpa_supplicant: {e}")
            return False
            
    def save_status(self) -> None:
        """Save current status to file for external access"""
        try:
            self.current_status["last_update"] = datetime.now().isoformat()
            with open(STATUS_FILE, 'w') as f:
                json.dump(self.current_status, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save status file: {e}")
            
    def poll_esp32(self) -> None:
        """Poll ESP32 for status updates and handle configuration"""
        while self.running:
            try:
                # Get status from ESP32
                esp32_status = self.send_command_to_esp32({"cmd": "get_status"})
                
                if esp32_status:
                    self.logger.debug(f"ESP32 status: {esp32_status}")
                    
                    # Update current status
                    self.current_status.update({
                        "esp32_status": esp32_status.get("status", "unknown"),
                        "esp32_ssid": esp32_status.get("ssid", ""),
                        "esp32_ip": esp32_status.get("ip", ""),
                        "esp32_error": esp32_status.get("error", "")
                    })
                    
                    # Check if ESP32 has new WiFi credentials
                    esp32_ssid = esp32_status.get("ssid", "")
                    if (esp32_status.get("status") == "connected" and 
                        esp32_ssid and 
                        esp32_ssid != self.current_status.get("ssid")):
                        
                        self.logger.info(f"ESP32 connected to new network: {esp32_ssid}")
                        # ESP32 is connected, we should connect too
                        # Note: In a real implementation, you'd need to get the password
                        # from ESP32 or use a different approach for credential sharing
                        
                # Get current Pi WiFi status
                pi_wifi_status = self.get_current_wifi_status()
                self.current_status.update(pi_wifi_status)
                
                # Scan for available networks periodically
                if int(time.time()) % 60 == 0:  # Every minute
                    self.scan_networks()
                    
                # Save status
                self.save_status()
                
            except Exception as e:
                self.logger.error(f"Error in polling loop: {e}")
                self.current_status["error"] = str(e)
                
            time.sleep(POLL_INTERVAL)
            
    def scan_networks(self) -> None:
        """Scan for available WiFi networks"""
        try:
            # Send scan command to ESP32
            esp32_response = self.send_command_to_esp32({"cmd": "scan_networks"})
            
            if esp32_response and "available_networks" in esp32_response:
                self.current_status["available_networks"] = esp32_response["available_networks"]
                self.logger.info(f"Found {len(esp32_response['available_networks'])} networks")
            else:
                # Fallback: scan using Pi's WiFi
                result = subprocess.run(
                    ['sudo', 'iwlist', 'wlan0', 'scan', '|', 'grep', 'ESSID'], 
                    shell=True,
                    capture_output=True, 
                    text=True, 
                    timeout=10
                )
                
                if result.returncode == 0:
                    networks = []
                    for line in result.stdout.split('\n'):
                        if 'ESSID:' in line:
                            ssid = line.split('ESSID:')[1].strip().strip('"')
                            if ssid and ssid != '':
                                networks.append(ssid)
                    
                    self.current_status["available_networks"] = networks
                    self.logger.info(f"Found {len(networks)} networks via Pi scan")
                
        except Exception as e:
            self.logger.error(f"Error scanning networks: {e}")
            
    def handle_new_credentials(self, ssid: str, password: str) -> bool:
        """Handle new WiFi credentials from ESP32"""
        try:
            self.logger.info(f"Received new credentials for network: {ssid}")
            
            # Update wpa_supplicant configuration
            if self.update_wpa_supplicant(ssid, password):
                # Wait for connection attempt
                time.sleep(5)
                
                # Check if connection was successful
                status = self.get_current_wifi_status()
                if status["status"] == "connected":
                    self.logger.info(f"Successfully connected to {ssid}")
                    return True
                else:
                    self.logger.warning(f"Failed to connect to {ssid}")
                    return False
            else:
                return False
                
        except Exception as e:
            self.logger.error(f"Error handling new credentials: {e}")
            return False
            
    def start_api_server(self) -> None:
        """Start simple HTTP API server for status queries"""
        from http.server import HTTPServer, BaseHTTPRequestHandler
        import threading
        
        class StatusHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                wifi_manager = self.server.wifi_manager
                
                if self.path == '/api/status':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    response = {
                        "status": wifi_manager.current_status.get("status", "unknown"),
                        "ssid": wifi_manager.current_status.get("ssid", ""),
                        "ip": wifi_manager.current_status.get("ip", ""),
                        "last_update": wifi_manager.current_status.get("last_update", ""),
                        "available_networks": wifi_manager.current_status.get("available_networks", []),
                        "error": wifi_manager.current_status.get("error", "")
                    }
                    
                    self.wfile.write(json.dumps(response, indent=2).encode())
                    
                elif self.path == '/api/networks':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    networks = wifi_manager.current_status.get("available_networks", [])
                    self.wfile.write(json.dumps({"networks": networks}).encode())
                    
                else:
                    self.send_response(404)
                    self.end_headers()
                    
            def log_message(self, format, *args):
                # Suppress default logging
                pass
        
        try:
            server = HTTPServer(('localhost', 8080), StatusHandler)
            server.wifi_manager = self
            
            def run_server():
                self.logger.info("Starting API server on port 8080")
                server.serve_forever()
                
            api_thread = threading.Thread(target=run_server, daemon=True)
            api_thread.start()
            
        except Exception as e:
            self.logger.error(f"Failed to start API server: {e}")
            
    def run(self) -> None:
        """Main run loop"""
        self.logger.info("Starting Camera Rig WiFi Manager")
        
        # Start API server in background
        self.start_api_server()
        
        # Start main polling loop
        try:
            self.poll_esp32()
        except KeyboardInterrupt:
            self.logger.info("Received keyboard interrupt")
        except Exception as e:
            self.logger.error(f"Unexpected error in main loop: {e}")
        finally:
            self.cleanup()
            
    def cleanup(self) -> None:
        """Cleanup resources"""
        self.logger.info("Cleaning up resources...")
        self.running = False
        
        if self.bus:
            try:
                self.bus.close()
            except Exception as e:
                self.logger.error(f"Error closing I2C bus: {e}")
                
        # Remove status file
        try:
            if os.path.exists(STATUS_FILE):
                os.remove(STATUS_FILE)
        except Exception as e:
            self.logger.error(f"Error removing status file: {e}")


def main():
    """Main entry point"""
    try:
        # Check if running as root (required for wpa_supplicant access)
        if os.geteuid() != 0:
            print("This daemon must be run as root (use sudo)")
            sys.exit(1)
            
        # Create and run WiFi manager
        wifi_manager = WiFiManager()
        wifi_manager.run()
        
    except Exception as e:
        logging.error(f"Failed to start WiFi manager: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()