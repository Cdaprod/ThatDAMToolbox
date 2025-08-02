#!/bin/bash
# /docker/touch-display/scripts/esp32_flashing.sh
# ESP32 WT-SC032 Firmware Flashing Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 ESP32 WT-SC032 Firmware Flash Script${NC}"
echo "======================================"

# Check if PlatformIO is installed
if ! command -v pio &> /dev/null; then
    echo -e "${RED}❌ PlatformIO CLI not found${NC}"
    echo "Install PlatformIO CLI: https://platformio.org/install/cli"
    echo "Or install via pip: pip install platformio"
    exit 1
fi

# Change to ESP32 directory
cd esp32

echo -e "${BLUE}📋 Available serial ports:${NC}"
pio device list

echo
read -p "Enter the serial port for your ESP32 (e.g., /dev/ttyUSB0): " SERIAL_PORT

if [ ! -e "$SERIAL_PORT" ]; then
    echo -e "${RED}❌ Serial port $SERIAL_PORT not found${NC}"
    exit 1
fi

echo -e "${YELLOW}⚡ Building firmware...${NC}"
pio run

echo -e "${YELLOW}📤 Flashing firmware to ESP32...${NC}"
pio run --target upload --upload-port "$SERIAL_PORT"

echo -e "${YELLOW}📊 Opening serial monitor...${NC}"
echo "Press Ctrl+C to exit monitor"
echo "Look for 'ESP32 WiFi Manager Ready' message"
echo

# Start serial monitor
pio device monitor --port "$SERIAL_PORT" --baud 115200

echo -e "${GREEN}✅ Firmware flashed successfully!${NC}"
echo
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Connect ESP32 to Raspberry Pi via I2C"
echo "2. Power on both devices"
echo "3. Test I2C communication with: sudo python3 /opt/camerarig/test_i2c.py"
echo "4. Start the Pi service: sudo systemctl start camerarig-wifi"