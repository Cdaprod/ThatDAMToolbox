/**
 * github.com/Cdaprod/ docker/touch-display/esp32/src/main.cpp
 * Camera Rig Touch Display - ESP32 WT-SC032 Firmware
 * 
 * Features:
 * - Touch display interface for WiFi configuration
 * - I2C slave communication with Raspberry Pi
 * - Captive portal for smartphone configuration
 * - WiFi network scanning and management
 * - EEPROM credential storage
 * - Status monitoring and display
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <EEPROM.h>
#include <Wire.h>
#include <TFT_eSPI.h>
#include <ArduinoJson.h>

// Hardware Configuration
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22
#define I2C_SLAVE_ADDR 0x42
#define TFT_BACKLIGHT_PIN 2

// Network Configuration
#define AP_SSID "CameraRig-Setup"
#define AP_PASSWORD "configure123"
#define DNS_PORT 53
#define HTTP_PORT 80

// EEPROM Configuration
#define EEPROM_SIZE 512
#define WIFI_SSID_ADDR 0
#define WIFI_PASS_ADDR 64
#define CONFIG_FLAG_ADDR 128

// Display Configuration
#define SCREEN_WIDTH 320
#define SCREEN_HEIGHT 170
#define STATUS_UPDATE_INTERVAL 1000
#define TOUCH_DEBOUNCE_MS 200

// I2C Communication Protocol
#define CMD_GET_STATUS 0x01
#define CMD_GET_NETWORKS 0x02
#define CMD_SET_CREDENTIALS 0x03
#define CMD_CLEAR_CONFIG 0x04
#define CMD_REBOOT 0x05

// System States
enum SystemState {
  STATE_INIT,
  STATE_AP_MODE,
  STATE_CONNECTING,
  STATE_CONNECTED,
  STATE_CONFIG_MODE,
  STATE_ERROR
};

// Global Objects
TFT_eSPI tft = TFT_eSPI();
WebServer server(HTTP_PORT);
DNSServer dnsServer;

// Global Variables
SystemState currentState = STATE_INIT;
unsigned long lastStatusUpdate = 0;
unsigned long lastTouchTime = 0;
String currentSSID = "";
String currentPassword = "";
String statusMessage = "Initializing...";
bool i2cDataAvailable = false;
uint8_t i2cBuffer[64];
int i2cBufferLength = 0;

// Touch coordinates
struct TouchPoint {
  int x, y;
  bool pressed;
};

TouchPoint lastTouch = {0, 0, false};

// Function Prototypes
void setupDisplay();
void setupI2C();
void setupWiFi();
void setupWebServer();
void handleRoot();
void handleScan();
void handleConnect();
void handleStatus();
void handleNotFound();
void updateDisplay();
void drawButton(int x, int y, int w, int h, String text, uint16_t color);
bool isButtonPressed(int x, int y, int w, int h, TouchPoint touch);
void loadWiFiCredentials();
void saveWiFiCredentials(String ssid, String password);
void clearWiFiCredentials();
void connectToWiFi();
void startAccessPoint();
void scanNetworks();
String getNetworksJson();
void handleI2CRequest();
void handleI2CReceive(int byteCount);
void processI2CCommand(uint8_t cmd, uint8_t* data, int length);
TouchPoint readTouch();
void setState(SystemState newState);
void logMessage(String message);

void setup() {
  Serial.begin(115200);
  Serial.println("Camera Rig Touch Display Starting...");
  
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Setup hardware
  setupDisplay();
  setupI2C();
  
  // Load saved credentials
  loadWiFiCredentials();
  
  // Initial display
  updateDisplay();
  
  // Try to connect to saved WiFi
  if (currentSSID.length() > 0) {
    setState(STATE_CONNECTING);
    connectToWiFi();
  } else {
    setState(STATE_AP_MODE);
    startAccessPoint();
  }
  
  setupWebServer();
  
  Serial.println("Setup complete");
}

void loop() {
  // Handle web server
  server.handleClient();
  dnsServer.processNextRequest();
  
  // Update display periodically
  if (millis() - lastStatusUpdate > STATUS_UPDATE_INTERVAL) {
    updateDisplay();
    lastStatusUpdate = millis();
  }
  
  // Handle touch input
  TouchPoint touch = readTouch();
  if (touch.pressed && (millis() - lastTouchTime > TOUCH_DEBOUNCE_MS)) {
    handleTouchInput(touch);
    lastTouchTime = millis();
  }
  
  // Check WiFi status
  if (currentState == STATE_CONNECTING && WiFi.status() == WL_CONNECTED) {
    setState(STATE_CONNECTED);
  } else if (currentState == STATE_CONNECTED && WiFi.status() != WL_CONNECTED) {
    setState(STATE_ERROR);
    statusMessage = "WiFi connection lost";
  }
  
  delay(10);
}

void setupDisplay() {
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);
  
  // Setup backlight
  pinMode(TFT_BACKLIGHT_PIN, OUTPUT);
  digitalWrite(TFT_BACKLIGHT_PIN, HIGH);
  
  // Initial splash screen
  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(2);
  tft.drawString("Camera Rig", 10, 10);
  tft.setTextSize(1);
  tft.drawString("Touch Display System", 10, 40);
  tft.drawString("Version 1.0", 10, 60);
  
  delay(2000);
  tft.fillScreen(TFT_BLACK);
}

void setupI2C() {
  Wire.begin(I2C_SLAVE_ADDR, I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.onRequest(handleI2CRequest);
  Wire.onReceive(handleI2CReceive);
  Serial.println("I2C slave initialized on address 0x42");
}

void setupWiFi() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);
}

void setupWebServer() {
  // Configure DNS server for captive portal
  dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());
  
  // Web server routes
  server.on("/", handleRoot);
  server.on("/scan", handleScan);
  server.on("/connect", HTTP_POST, handleConnect);
  server.on("/status", handleStatus);
  server.onNotFound(handleNotFound);
  
  server.begin();
  Serial.println("Web server started");
}

void handleRoot() {
  String html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <title>Camera Rig WiFi Setup</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial; margin: 20px; background: #f0f0f0; }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
        h1 { color: #333; text-align: center; }
        .network { padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 5px; cursor: pointer; }
        .network:hover { background: #e0e0e0; }
        .form-group { margin: 10px 0; }
        label { display: block; margin-bottom: 5px; }
        input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .status { margin: 10px 0; padding: 10px; background: #e9ecef; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📹 Camera Rig WiFi Setup</h1>
        <div class="status" id="status">Scanning networks...</div>
        
        <div id="networks"></div>
        
        <form onsubmit="connectWiFi(event)">
            <div class="form-group">
                <label>Network Name (SSID):</label>
                <input type="text" id="ssid" required>
            </div>
            <div class="form-group">
                <label>Password:</label>
                <input type="password" id="password">
            </div>
            <button type="submit">Connect</button>
        </form>
        
        <button onclick="scanNetworks()" style="margin-top: 10px; background: #28a745;">Refresh Networks</button>
    </div>

    <script>
        function scanNetworks() {
            document.getElementById('status').innerText = 'Scanning...';
            fetch('/scan')
                .then(response => response.json())
                .then(data => {
                    const networksDiv = document.getElementById('networks');
                    networksDiv.innerHTML = '';
                    data.networks.forEach(network => {
                        const div = document.createElement('div');
                        div.className = 'network';
                        div.innerHTML = `<strong>${network.ssid}</strong> (${network.rssi}dBm) ${network.secure ? '🔒' : ''}`;
                        div.onclick = () => document.getElementById('ssid').value = network.ssid;
                        networksDiv.appendChild(div);
                    });
                    document.getElementById('status').innerText = `Found ${data.networks.length} networks`;
                })
                .catch(err => {
                    document.getElementById('status').innerText = 'Scan failed';
                });
        }
        
        function connectWiFi(event) {
            event.preventDefault();
            const ssid = document.getElementById('ssid').value;
            const password = document.getElementById('password').value;
            
            document.getElementById('status').innerText = 'Connecting...';
            
            const formData = new FormData();
            formData.append('ssid', ssid);
            formData.append('password', password);
            
            fetch('/connect', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('status').innerText = data.message;
                if (data.success) {
                    setTimeout(() => {
                        document.getElementById('status').innerText = 'Connection successful! You can close this page.';
                    }, 3000);
                }
            })
            .catch(err => {
                document.getElementById('status').innerText = 'Connection failed';
            });
        }
        
        // Auto-scan on load
        scanNetworks();
        
        // Auto-refresh status
        setInterval(() => {
            fetch('/status')
                .then(response => response.json())
                .then(data => {
                    if (data.connected) {
                        document.getElementById('status').innerText = `Connected to ${data.ssid}`;
                    }
                });
        }, 5000);
    </script>
</body>
</html>
)rawliteral";
  
  server.send(200, "text/html", html);
}

void handleScan() {
  String json = getNetworksJson();
  server.send(200, "application/json", json);
}

void handleConnect() {
  if (server.hasArg("ssid")) {
    String ssid = server.arg("ssid");
    String password = server.hasArg("password") ? server.arg("password") : "";
    
    // Save credentials
    saveWiFiCredentials(ssid, password);
    
    // Start connection
    currentSSID = ssid;
    currentPassword = password;
    setState(STATE_CONNECTING);
    
    WiFi.begin(currentSSID.c_str(), currentPassword.c_str());
    
    server.send(200, "application/json", "{\"success\":true,\"message\":\"Connecting to " + ssid + "...\"}");
  } else {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Missing SSID\"}");
  }
}

void handleStatus() {
  DynamicJsonDocument doc(200);
  doc["connected"] = (WiFi.status() == WL_CONNECTED);
  doc["ssid"] = WiFi.SSID();
  doc["ip"] = WiFi.localIP().toString();
  doc["state"] = currentState;
  doc["message"] = statusMessage;
  
  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

void handleNotFound() {
  // Redirect to root for captive portal
  server.sendHeader("Location", "/", true);
  server.send(302, "text/plain", "");
}

void updateDisplay() {
  tft.fillScreen(TFT_BLACK);
  
  // Header
  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(2);
  tft.drawString("Camera Rig WiFi", 10, 10);
  
  // Status area
  tft.setTextSize(1);
  String stateText = "";
  uint16_t stateColor = TFT_WHITE;
  
  switch (currentState) {
    case STATE_INIT:
      stateText = "Initializing...";
      stateColor = TFT_YELLOW;
      break;
    case STATE_AP_MODE:
      stateText = "Setup Mode Active";
      stateColor = TFT_CYAN;
      break;
    case STATE_CONNECTING:
      stateText = "Connecting...";
      stateColor = TFT_YELLOW;
      break;
    case STATE_CONNECTED:
      stateText = "Connected ✓";
      stateColor = TFT_GREEN;
      break;
    case STATE_CONFIG_MODE:
      stateText = "Configuration Mode";
      stateColor = TFT_MAGENTA;
      break;
    case STATE_ERROR:
      stateText = "Error";
      stateColor = TFT_RED;
      break;
  }
  
  tft.setTextColor(stateColor);
  tft.drawString("Status: " + stateText, 10, 35);
  
  // Network info
  tft.setTextColor(TFT_WHITE);
  if (WiFi.status() == WL_CONNECTED) {
    tft.drawString("Network: " + WiFi.SSID(), 10, 50);
    tft.drawString("IP: " + WiFi.localIP().toString(), 10, 65);
  } else if (currentState == STATE_AP_MODE) {
    tft.drawString("AP: " + String(AP_SSID), 10, 50);
    tft.drawString("IP: " + WiFi.softAPIP().toString(), 10, 65);
  }
  
  // Status message
  tft.setTextColor(TFT_YELLOW);
  tft.drawString(statusMessage, 10, 85);
  
  // Instructions
  tft.setTextColor(TFT_CYAN);
  if (currentState == STATE_AP_MODE) {
    tft.drawString("1. Connect phone to CameraRig-Setup", 10, 105);
    tft.drawString("2. Open browser (any page)", 10, 120);
    tft.drawString("3. Configure WiFi", 10, 135);
  } else if (currentState == STATE_CONNECTED) {
    tft.drawString("Ready for camera operations", 10, 105);
  }
  
  // Touch buttons
  if (currentState == STATE_CONNECTED || currentState == STATE_ERROR) {
    drawButton(220, 120, 80, 30, "Reset", TFT_RED);
  }
  if (currentState == STATE_AP_MODE) {
    drawButton(220, 120, 80, 30, "Scan", TFT_BLUE);
  }
}

void drawButton(int x, int y, int w, int h, String text, uint16_t color) {
  tft.drawRect(x, y, w, h, color);
  tft.setTextColor(color);
  int textX = x + (w - text.length() * 6) / 2;
  int textY = y + (h - 8) / 2;
  tft.drawString(text, textX, textY);
}

bool isButtonPressed(int x, int y, int w, int h, TouchPoint touch) {
  return touch.pressed && 
         touch.x >= x && touch.x <= x + w &&
         touch.y >= y && touch.y <= y + h;
}

void handleTouchInput(TouchPoint touch) {
  // Reset button
  if (isButtonPressed(220, 120, 80, 30, touch)) {
    if (currentState == STATE_CONNECTED || currentState == STATE_ERROR) {
      clearWiFiCredentials();
      setState(STATE_AP_MODE);
      startAccessPoint();
      statusMessage = "Configuration cleared";
    } else if (currentState == STATE_AP_MODE) {
      scanNetworks();
      statusMessage = "Networks scanned";
    }
  }
}

void loadWiFiCredentials() {
  uint8_t flag = EEPROM.read(CONFIG_FLAG_ADDR);
  if (flag == 0xAA) {
    currentSSID = "";
    currentPassword = "";
    
    for (int i = 0; i < 32; i++) {
      char c = EEPROM.read(WIFI_SSID_ADDR + i);
      if (c == 0) break;
      currentSSID += c;
    }
    
    for (int i = 0; i < 32; i++) {
      char c = EEPROM.read(WIFI_PASS_ADDR + i);
      if (c == 0) break;
      currentPassword += c;
    }
    
    Serial.println("Loaded WiFi credentials: " + currentSSID);
  }
}

void saveWiFiCredentials(String ssid, String password) {
  // Clear existing data
  for (int i = 0; i < 64; i++) {
    EEPROM.write(WIFI_SSID_ADDR + i, 0);
    EEPROM.write(WIFI_PASS_ADDR + i, 0);
  }
  
  // Write SSID
  for (int i = 0; i < ssid.length() && i < 31; i++) {
    EEPROM.write(WIFI_SSID_ADDR + i, ssid[i]);
  }
  
  // Write password
  for (int i = 0; i < password.length() && i < 31; i++) {
    EEPROM.write(WIFI_PASS_ADDR + i, password[i]);
  }
  
  // Set configuration flag
  EEPROM.write(CONFIG_FLAG_ADDR, 0xAA);
  EEPROM.commit();
  
  Serial.println("WiFi credentials saved");
}

void clearWiFiCredentials() {
  EEPROM.write(CONFIG_FLAG_ADDR, 0x00);
  EEPROM.commit();
  currentSSID = "";
  currentPassword = "";
  Serial.println("WiFi credentials cleared");
}

void connectToWiFi() {
  statusMessage = "Connecting to " + currentSSID;
  WiFi.begin(currentSSID.c_str(), currentPassword.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    setState(STATE_CONNECTED);
    statusMessage = "Connected successfully";
    Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
  } else {
    setState(STATE_ERROR);
    statusMessage = "Connection failed";
    Serial.println("\nWiFi connection failed");
  }
}

void startAccessPoint() {
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  statusMessage = "Setup portal active";
  Serial.println("Access Point started: " + String(AP_SSID));
  Serial.println("IP address: " + WiFi.softAPIP().toString());
}

void scanNetworks() {
  int n = WiFi.scanNetworks();
  Serial.println("Scan complete. Networks found: " + String(n));
}

String getNetworksJson() {
  DynamicJsonDocument doc(2048);
  JsonArray networks = doc.createNestedArray("networks");
  
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    JsonObject network = networks.createNestedObject();
    network["ssid"] = WiFi.SSID(i);
    network["rssi"] = WiFi.RSSI(i);
    network["secure"] = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
  }
  
  String output;
  serializeJson(doc, output);
  return output;
}

void handleI2CRequest() {
  // Send status data to Pi
  DynamicJsonDocument doc(128);
  doc["state"] = currentState;
  doc["connected"] = (WiFi.status() == WL_CONNECTED);
  doc["ssid"] = WiFi.SSID();
  doc["ip"] = WiFi.localIP().toString();
  
  String output;
  serializeJson(doc, output);
  
  uint8_t buffer[32];
  int len = min(output.length(), 31);
  output.getBytes(buffer, len + 1);
  
  Wire.write(buffer, len);
}

void handleI2CReceive(int byteCount) {
  if (byteCount > 0) {
    uint8_t cmd = Wire.read();
    uint8_t data[16];
    int dataLen = 0;
    
    while (Wire.available() && dataLen < 16) {
      data[dataLen++] = Wire.read();
    }
    
    processI2CCommand(cmd, data, dataLen);
  }
}

void processI2CCommand(uint8_t cmd, uint8_t* data, int length) {
  switch (cmd) {
    case CMD_GET_STATUS:
      // Status already sent in handleI2CRequest
      break;
      
    case CMD_GET_NETWORKS:
      scanNetworks();
      break;
      
    case CMD_CLEAR_CONFIG:
      clearWiFiCredentials();
      setState(STATE_AP_MODE);
      startAccessPoint();
      break;
      
    case CMD_REBOOT:
      ESP.restart();
      break;
      
    default:
      Serial.println("Unknown I2C command: " + String(cmd));
      break;
  }
}

TouchPoint readTouch() {
  TouchPoint point = {0, 0, false};
  
  // This is a placeholder for actual touch reading
  // Implementation depends on specific touch controller
  // Common controllers: GT911, FT6336, CST816S
  
  return point;
}

void setState(SystemState newState) {
  if (currentState != newState) {
    Serial.println("State change: " + String(currentState) + " -> " + String(newState));
    currentState = newState;
  }
}

void logMessage(String message) {
  Serial.println("[" + String(millis()) + "] " + message);
  statusMessage = message;
}