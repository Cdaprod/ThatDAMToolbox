#!/bin/bash
# /docker/touch-display/pi/config/i2c_setup.sh
# Camera Rig Touch Display Setup Script for Raspberry Pi 5
# Run this script on a fresh Raspberry Pi OS installation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/camerarig"
SERVICE_NAME="camerarig-wifi"
LOG_FILE="/var/log/camerarig-setup.log"

echo -e "${BLUE}🚀 Camera Rig Touch Display Setup${NC}"
echo "=================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Log function
log() {
    echo -e "$1"
    echo "$(date): $1" >> "$LOG_FILE"
}

log "${YELLOW}📋 Starting setup process...${NC}"

# Update system
log "${BLUE}📦 Updating system packages...${NC}"
apt update && apt upgrade -y

# Install required packages
log "${BLUE}📦 Installing required packages...${NC}"
apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    i2c-tools \
    wireless-tools \
    wpasupplicant \
    git \
    curl \
    build-essential

# Install Python packages
log "${BLUE}🐍 Installing Python dependencies...${NC}"
pip3 install --break-system-packages \
    smbus2 \
    flask \
    requests

# Enable I2C interface
log "${BLUE}🔌 Enabling I2C interface...${NC}"
raspi-config nonint do_i2c 0

# Add I2C configuration to /boot/config.txt if not present
if ! grep -q "dtparam=i2c_arm=on" /boot/config.txt; then
    echo "dtparam=i2c_arm=on" >> /boot/config.txt
fi

if ! grep -q "dtparam=i2c1=on" /boot/config.txt; then
    echo "dtparam=i2c1=on" >> /boot/config.txt
fi

# Set I2C baudrate for better performance
if ! grep -q "dtparam=i2c_arm_baudrate" /boot/config.txt; then
    echo "dtparam=i2c_arm_baudrate=100000" >> /boot/config.txt
fi

# Create project directory
log "${BLUE}📁 Creating project directory...${NC}"
mkdir -p "$PROJECT_DIR"
mkdir -p /var/log

# Copy project files (assuming they're in current directory)
log "${BLUE}📋 Installing project files...${NC}"
cp pi/wifi_manager.py "$PROJECT_DIR/"
chmod +x "$PROJECT_DIR/wifi_manager.py"

# Install systemd service
log "${BLUE}⚙️  Installing systemd service...${NC}"
cp pi/systemd/camerarig-wifi.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

# Create configuration file
log "${BLUE}📝 Creating configuration...${NC}"
cat > "$PROJECT_DIR/config.json" << EOF
{
    "i2c_bus": 1,
    "esp32_address": 8,
    "poll_interval": 10,
    "log_level": "INFO",
    "api_port": 8080,
    "wpa_supplicant_conf": "/etc/wpa_supplicant/wpa_supplicant.conf"
}
EOF

# Set up log rotation
log "${BLUE}📄 Setting up log rotation...${NC}"
cat > /etc/logrotate.d/camerarig << EOF
/var/log/camerarig-setup.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Create I2C test script
log "${BLUE}🧪 Creating I2C test script...${NC}"
cat > "$PROJECT_DIR/test_i2c.py" << 'EOF'
#!/usr/bin/env python3
import smbus2
import time
import sys

def test_i2c_connection():
    """Test I2C connection to ESP32"""
    try:
        bus = smbus2.SMBus(1)
        
        # Try to detect ESP32 at address 0x08
        try:
            bus.read_byte(0x08)
            print("✅ ESP32 detected at I2C address 0x08")
            return True
        except OSError:
            print("❌ ESP32 not detected at I2C address 0x08")
            return False
            
    except Exception as e:
        print(f"❌ I2C bus error: {e}")
        return False
    finally:
        if 'bus' in locals():
            bus.close()

def scan_i2c_devices():
    """Scan for all I2C devices"""
    print("Scanning I2C bus for devices...")
    try:
        bus = smbus2.SMBus(1)
        devices = []
        
        for addr in range(0x03, 0x78):
            try:
                bus.read_byte(addr)
                devices.append(addr)
                print(f"Found device at address: 0x{addr:02x}")
            except OSError:
                pass
                
        if not devices:
            print("No I2C devices found")
        else:
            print(f"Found {len(devices)} I2C device(s)")
            
    except Exception as e:
        print(f"Error scanning I2C bus: {e}")
    finally:
        if 'bus' in locals():
            bus.close()

if __name__ == "__main__":
    print("Camera Rig I2C Test")
    print("==================")
    
    scan_i2c_devices()
    print()
    test_i2c_connection()
EOF

chmod +x "$PROJECT_DIR/test_i2c.py"

# Create startup script
log "${BLUE}🚀 Creating startup script...${NC}"
cat > "$PROJECT_DIR/start.sh" << EOF
#!/bin/bash
# Camera Rig WiFi Manager Startup Script

echo "Starting Camera Rig WiFi Manager..."

# Test I2C connection first
python3 "$PROJECT_DIR/test_i2c.py"

# Start the service
systemctl start "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager

echo "Service started. Check logs with: journalctl -u $SERVICE_NAME -f"
EOF

chmod +x "$PROJECT_DIR/start.sh"

# Create status check script
log "${BLUE}📊 Creating status script...${NC}"
cat > "$PROJECT_DIR/status.sh" << EOF
#!/bin/bash
# Camera Rig Status Check Script

echo "Camera Rig WiFi Manager Status"
echo "=============================="

echo "Service Status:"
systemctl status $SERVICE_NAME --no-pager
echo

echo "Recent Logs:"
journalctl -u $SERVICE_NAME --no-pager -n 20
echo

echo "I2C Devices:"
i2cdetect -y 1
echo

echo "WiFi Status:"
iwconfig wlan0 2>/dev/null | grep -E "(ESSID|Access Point|Bit Rate)"
echo

echo "IP Address:"
hostname -I
echo

if [ -f "/tmp/camerarig_status.json" ]; then
    echo "Current Status:"
    cat /tmp/camerarig_status.json | python3 -m json.tool
fi
EOF

chmod +x "$PROJECT_DIR/status.sh"

# Set proper permissions
chown -R root:root "$PROJECT_DIR"
chmod -R 755 "$PROJECT_DIR"

# Add user to i2c group (if pi user exists)
if id "pi" &>/dev/null; then
    usermod -a -G i2c pi
    log "${GREEN}✅ Added pi user to i2c group${NC}"
fi

log "${GREEN}✅ Setup completed successfully!${NC}"
echo
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Reboot the Raspberry Pi to enable I2C interface"
echo "2. Connect ESP32 WT-SC032 via I2C (SDA/SCL pins)"
echo "3. Flash ESP32 firmware using provided script"
echo "4. Test I2C connection: sudo $PROJECT_DIR/test_i2c.py"
echo "5. Start service: sudo systemctl start $SERVICE_NAME"
echo "6. Check status: sudo $PROJECT_DIR/status.sh"
echo
echo -e "${GREEN}🎉 Installation complete! Reboot now to activate I2C interface.${NC}"

# Offer to reboot
read -p "Reboot now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "${BLUE}🔄 Rebooting system...${NC}"
    reboot
fi