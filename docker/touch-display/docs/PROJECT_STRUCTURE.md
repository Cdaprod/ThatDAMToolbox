# Camera Rig Touch Display Project Structure

/docker/touch-display/docs/PROJECT_STRUCTURE.md

```
/docker/touch-display/
├── README.md                           # Project documentation and setup guide
├── docker-compose.yml                  # Docker compose for Pi services
├── Dockerfile                          # Dockerfile for Pi daemon
├── requirements.txt                    # Python dependencies
├── esp32/
│   ├── platformio.ini                  # PlatformIO configuration
│   ├── src/
│   │   └── main.cpp                    # ESP32 firmware source
│   ├── lib/
│   └── include/
├── pi/
│   ├── wifi_manager.py                 # Main WiFi management daemon
│   ├── install.sh                      # Installation script for Pi
│   ├── systemd/
│   │   └── camerarig-wifi.service      # Systemd service file
│   └── config/
│       └── i2c_setup.sh                # I2C configuration script
├── scripts/
│   ├── setup_pi.sh                     # Complete Pi setup script
│   ├── flash_esp32.sh                  # ESP32 flashing script
│   └── test_i2c.py                     # I2C communication test
├── docs/
│   ├── WIRING.md                       # Wiring diagrams and instructions
│   ├── SETUP.md                        # Detailed setup instructions
│   └── TROUBLESHOOTING.md              # Common issues and solutions
└── config/
    ├── config.json                     # Default configuration
    └── hardware_profiles/
        └── wt-sc032.json               # WT-SC032 specific configuration
```

## Key Files Overview:

### ESP32 Files:

- `esp32/src/main.cpp` - Complete ESP32 firmware with captive portal and I2C communication
- `esp32/platformio.ini` - PlatformIO build configuration for ESP32

### Raspberry Pi Files:

- `pi/wifi_manager.py` - Main Python daemon for WiFi management
- `pi/systemd/camerarig-wifi.service` - Systemd service for auto-startup
- `pi/install.sh` - Automated installation script
- `pi/config/i2c_setup.sh` - I2C interface configuration

### Setup Scripts:

- `scripts/setup_pi.sh` - Complete Raspberry Pi setup automation
- `scripts/flash_esp32.sh` - ESP32 firmware flashing script
- `scripts/test_i2c.py` - I2C communication testing tool

### Documentation:

- `docs/WIRING.md` - Hardware connection diagrams
- `docs/SETUP.md` - Step-by-step setup instructions
- `docs/TROUBLESHOOTING.md` - Common problems and solutions

### Configuration:

- `config/config.json` - System configuration parameters
- `config/hardware_profiles/wt-sc032.json` - Hardware-specific settings