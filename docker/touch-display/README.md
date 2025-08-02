# Camera Rig Touch Display Project
/docker/touch-display/README.md

A complete integration system for Raspberry Pi 5 + WT-SC032 ESP32 touch display, providing standalone WiFi configuration for camera rig applications.

## 🎯 Features

- **Standalone WiFi Configuration**: Configure Pi WiFi through ESP32 touchscreen without external keyboard/monitor
- **Captive Portal**: User-friendly web interface accessible via smartphone
- **I2C Communication**: Reliable Pi ↔ ESP32 data exchange
- **Persistent Storage**: WiFi credentials saved on ESP32 EEPROM
- **Auto-Recovery**: Automatic reconnection and error handling
- **Status Monitoring**: Real-time connection status and network scanning
- **Containerized Deployment**: Docker support for easy deployment

## 🏗️ Architecture

```
┌─────────────────┐    I2C     ┌─────────────────────┐
│  Raspberry Pi 5 │◄──────────►│ ESP32 WT-SC032      │
│                 │            │ - Touch Display     │
│ - WiFi Manager  │            │ - Captive Portal    │
│ - I2C Master    │            │ - WiFi Scanning     │
│ - Network Mgmt  │            │ - I2C Slave         │
└─────────────────┘            └─────────────────────┘
         │                              │
         │                              │
         ▼                              ▼
   Router/Internet              User's Smartphone
   (Target Network)             (Configuration)
```

## 📦 Project Structure

```
/docker/touch-display/
├── README.md                    # This file
├── docker-compose.yml           # Docker deployment
├── Dockerfile                   # Pi service container
├── requirements.txt             # Python dependencies
├── esp32/                       # ESP32 firmware
│   ├── platformio.ini          
│   └── src/main.cpp
├── pi/                         # Raspberry Pi components
│   ├── wifi_manager.py         # Main daemon
│   └── systemd/
├── scripts/                    # Setup and utility scripts
│   ├── setup_pi.sh
│   └── flash_esp32.sh
└── docs/                       # Documentation
```

## 🚀 Quick Start

### 1. Hardware Setup

**Wiring (I2C Connection):**

```
Raspberry Pi 5    →    ESP32 WT-SC032
GPIO2 (SDA)      →    GPIO21 (SDA)
GPIO3 (SCL)      →    GPIO22 (SCL)  
GND              →    GND
3.3V             →    3.3V
```

### 2. Raspberry Pi Setup

```bash
# Clone and navigate to project
cd /docker/touch-display

# Run automated setup (requires sudo)
sudo ./scripts/setup_pi.sh

# Reboot to enable I2C
sudo reboot
```

### 3. ESP32 Firmware Flash

```bash
# Install PlatformIO CLI if not installed
pip install platformio

# Flash ESP32 firmware
./scripts/flash_esp32.sh
```

### 4. Deployment Options

**Option A: Systemd Service (Recommended)**

```bash
# Service is auto-installed by setup script
sudo systemctl start camerarig-wifi
sudo systemctl status camerarig-wifi
```

**Option B: Docker**

```bash
# Build and run with Docker Compose
docker-compose up -d
```