#!/bin/bash
# sudo-tee.sh - Complete NinjaPi TUI Setup Script
# Run from /docker/tft-display/ directory

set -e

echo "🚀 Setting up NinjaPi TUI from /docker/tft-display/"
echo "Current directory: $(pwd)"

# Ensure we're in the right directory
if [[ ! "$(pwd)" =~ /docker/tft-display/?$ ]]; then
    echo "❌ Please run this script from /docker/tft-display/ directory"
    exit 1
fi

# Create project structure
echo "📁 Creating project structure..."
sudo mkdir -p /home/pi/ninjapi-tui
sudo chown pi:pi /home/pi/ninjapi-tui

# 1. Write go.mod
echo "📝 Writing go.mod..."
sudo tee /home/pi/ninjapi-tui/go.mod > /dev/null << 'EOF'
module ninjapi-tui

go 1.21

require (
    github.com/charmbracelet/bubbletea v0.24.2
    github.com/charmbracelet/lipgloss v0.9.1
    github.com/stianeikeland/go-rpio/v4 v4.6.0
)
EOF

# 2. Write main.go (TUI application)
echo "📝 Writing main.go..."
sudo tee /home/pi/ninjapi-tui/main.go > /dev/null << 'EOF'
package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Screen dimensions for 1.14" TFT (typically 240x135 or similar)
const (
	maxWidth  = 30  // Characters wide
	maxHeight = 8   // Lines tall
)

// Styles optimized for small screen
var (
	titleStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("15")).
		Background(lipgloss.Color("4")).
		Padding(0, 1)
	
	statusStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("10"))
	
	infoStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("7"))
	
	buttonStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("0")).
		Background(lipgloss.Color("11")).
		Padding(0, 1)
)

type model struct {
	recording   bool
	mode        int  // 0=status, 1=settings, 2=info
	uptime      time.Duration
	startTime   time.Time
	buttonChan  chan ButtonPress
}

type ButtonPress struct {
	Button int // 1 or 2
}

type tickMsg time.Time
type buttonMsg ButtonPress

func (m model) Init() tea.Cmd {
	return tea.Batch(
		tickCmd(),
		waitForButton(m.buttonChan),
	)
}

func tickCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func waitForButton(buttonChan chan ButtonPress) tea.Cmd {
	return func() tea.Msg {
		return buttonMsg(<-buttonChan)
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tickMsg:
		m.uptime = time.Since(m.startTime)
		return m, tickCmd()
		
	case buttonMsg:
		switch msg.Button {
		case 1: // Button 1 - Toggle recording
			m.recording = !m.recording
		case 2: // Button 2 - Cycle modes
			m.mode = (m.mode + 1) % 3
		}
		return m, waitForButton(m.buttonChan)
		
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "1":
			m.recording = !m.recording
		case "2":
			m.mode = (m.mode + 1) % 3
		}
	}
	return m, nil
}

func (m model) View() string {
	switch m.mode {
	case 0:
		return m.statusView()
	case 1:
		return m.settingsView()
	case 2:
		return m.infoView()
	default:
		return m.statusView()
	}
}

func (m model) statusView() string {
	// Header
	header := titleStyle.Render("NINJAPI")
	
	// Recording status
	recStatus := "IDLE"
	if m.recording {
		recStatus = "REC"
	}
	status := statusStyle.Render(fmt.Sprintf("● %s", recStatus))
	
	// Uptime
	uptime := infoStyle.Render(fmt.Sprintf("UP: %s", formatDuration(m.uptime)))
	
	// Button hints
	btn1 := buttonStyle.Render("B1:REC")
	btn2 := buttonStyle.Render("B2:MODE")
	
	return fmt.Sprintf("%s\n\n%s\n%s\n\n%s %s", 
		header, status, uptime, btn1, btn2)
}

func (m model) settingsView() string {
	header := titleStyle.Render("SETTINGS")
	
	recMode := "Mode: Video"
	quality := "Quality: HD"
	audio := "Audio: ON"
	
	btn1 := buttonStyle.Render("B1:TOGGLE")
	btn2 := buttonStyle.Render("B2:EXIT")
	
	return fmt.Sprintf("%s\n\n%s\n%s\n%s\n\n%s %s", 
		header, recMode, quality, audio, btn1, btn2)
}

func (m model) infoView() string {
	header := titleStyle.Render("SYSTEM")
	
	temp := "Temp: 45°C"
	storage := "Storage: 85%"
	network := "WiFi: Connected"
	
	btn1 := buttonStyle.Render("B1:REFRESH")
	btn2 := buttonStyle.Render("B2:EXIT")
	
	return fmt.Sprintf("%s\n\n%s\n%s\n%s\n\n%s %s", 
		header, temp, storage, network, btn1, btn2)
}

func formatDuration(d time.Duration) string {
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60
	seconds := int(d.Seconds()) % 60
	
	if hours > 0 {
		return fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)
	}
	return fmt.Sprintf("%02d:%02d", minutes, seconds)
}

// Main function with real GPIO integration
func main() {
	// Set up logging for debugging
	logFile, err := os.OpenFile("/tmp/ninjapi.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Println("Failed to open log file, using stdout")
	} else {
		log.SetOutput(logFile)
		defer logFile.Close()
	}

	log.Println("Starting NinjaPi TUI...")

	// Create button channel
	buttonChan := make(chan ButtonPress, 10)
	
	// Initialize GPIO handler
	gpioHandler := NewGPIOHandler(buttonChan)
	if gpioHandler != nil {
		defer gpioHandler.Close()
		// Use interrupt-based monitoring for better performance
		gpioHandler.StartInterruptMonitoring()
		log.Println("GPIO monitoring started")
	} else {
		// Fallback to signal simulation for testing
		log.Println("Using signal simulation mode")
		simulateButtons(buttonChan)
	}
	
	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)
	
	// Initialize model
	m := model{
		recording:  false,
		mode:       0,
		startTime:  time.Now(),
		buttonChan: buttonChan,
	}
	
	// Configure program for small TFT screen
	p := tea.NewProgram(m, 
		tea.WithAltScreen(), 
		tea.WithMouseCellMotion(),
	)
	
	// Handle shutdown in goroutine
	go func() {
		<-sigChan
		log.Println("Shutting down...")
		p.Quit()
	}()
	
	log.Println("Starting TUI...")
	if err := p.Start(); err != nil {
		log.Printf("Error running TUI: %v", err)
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	
	log.Println("TUI stopped")
}

// Keep the simulation function for development/testing
func simulateButtons(buttonChan chan ButtonPress) {
	c1 := make(chan os.Signal, 1)
	c2 := make(chan os.Signal, 1)
	signal.Notify(c1, syscall.SIGUSR1) // kill -USR1 <pid> for button 1
	signal.Notify(c2, syscall.SIGUSR2) // kill -USR2 <pid> for button 2
	
	go func() {
		for {
			select {
			case <-c1:
				buttonChan <- ButtonPress{Button: 1}
				log.Println("Simulated button 1 press")
			case <-c2:
				buttonChan <- ButtonPress{Button: 2}
				log.Println("Simulated button 2 press")
			}
		}
	}()
}
EOF

# 3. Write gpio.go (GPIO handler)
echo "📝 Writing gpio.go..."
sudo tee /home/pi/ninjapi-tui/gpio.go > /dev/null << 'EOF'
package main

import (
	"log"
	"time"
	
	"github.com/stianeikeland/go-rpio/v4"
)

// GPIO pin assignments (adjust based on your wiring)
const (
	Button1Pin = 17 // BCM pin 17 (physical pin 11)
	Button2Pin = 27 // BCM pin 27 (physical pin 13)
)

type GPIOHandler struct {
	button1     rpio.Pin
	button2     rpio.Pin
	buttonChan  chan ButtonPress
	lastPress1  time.Time
	lastPress2  time.Time
	debounceMs  int
}

func NewGPIOHandler(buttonChan chan ButtonPress) *GPIOHandler {
	// Open GPIO memory access
	err := rpio.Open()
	if err != nil {
		log.Printf("Failed to open GPIO: %v", err)
		return nil
	}

	handler := &GPIOHandler{
		button1:    rpio.Pin(Button1Pin),
		button2:    rpio.Pin(Button2Pin),
		buttonChan: buttonChan,
		debounceMs: 200, // 200ms debounce
	}

	// Configure pins as inputs with pull-up resistors
	handler.button1.Input()
	handler.button1.PullUp()
	
	handler.button2.Input()
	handler.button2.PullUp()

	return handler
}

func (g *GPIOHandler) StartMonitoring() {
	if g == nil {
		log.Println("GPIO handler not initialized, using simulation mode")
		return
	}

	go g.monitorButtons()
}

func (g *GPIOHandler) monitorButtons() {
	// Track previous states for edge detection
	prevState1 := g.button1.Read()
	prevState2 := g.button2.Read()

	for {
		// Read current states
		currentState1 := g.button1.Read()
		currentState2 := g.button2.Read()

		// Check for button 1 press (falling edge with debounce)
		if prevState1 == rpio.High && currentState1 == rpio.Low {
			if time.Since(g.lastPress1) > time.Duration(g.debounceMs)*time.Millisecond {
				g.buttonChan <- ButtonPress{Button: 1}
				g.lastPress1 = time.Now()
				log.Println("Button 1 pressed")
			}
		}

		// Check for button 2 press (falling edge with debounce)
		if prevState2 == rpio.High && currentState2 == rpio.Low {
			if time.Since(g.lastPress2) > time.Duration(g.debounceMs)*time.Millisecond {
				g.buttonChan <- ButtonPress{Button: 2}
				g.lastPress2 = time.Now()
				log.Println("Button 2 pressed")
			}
		}

		// Update previous states
		prevState1 = currentState1
		prevState2 = currentState2

		// Small delay to prevent excessive CPU usage
		time.Sleep(10 * time.Millisecond)
	}
}

func (g *GPIOHandler) Close() {
	if g != nil {
		rpio.Close()
	}
}

// Alternative: Interrupt-based GPIO (more efficient)
func (g *GPIOHandler) StartInterruptMonitoring() {
	if g == nil {
		return
	}

	// Set up edge detection for falling edges (button press)
	g.button1.Detect(rpio.FallEdge)
	g.button2.Detect(rpio.FallEdge)

	go func() {
		for {
			// Wait for edge events
			if g.button1.EdgeDetected() {
				if time.Since(g.lastPress1) > time.Duration(g.debounceMs)*time.Millisecond {
					g.buttonChan <- ButtonPress{Button: 1}
					g.lastPress1 = time.Now()
					log.Println("Button 1 interrupt")
				}
			}

			if g.button2.EdgeDetected() {
				if time.Since(g.lastPress2) > time.Duration(g.debounceMs)*time.Millisecond {
					g.buttonChan <- ButtonPress{Button: 2}
					g.lastPress2 = time.Now()
					log.Println("Button 2 interrupt")
				}
			}

			time.Sleep(50 * time.Millisecond)
		}
	}()
}
EOF

# 4. Write launch script
echo "📝 Writing launch-tui.sh..."
sudo tee /home/pi/launch-tui.sh > /dev/null << 'EOF'
#!/bin/bash
export TERM=linux
export FRAMEBUFFER=/dev/fb1
# Switch to console 1 and launch with fbterm for better font rendering
chvt 1
fbterm -s 12 /home/pi/ninjapi-tui/ninjapi-tui
EOF

sudo chmod +x /home/pi/launch-tui.sh

# 5. Write systemd service
echo "📝 Writing systemd service..."
sudo tee /etc/systemd/system/ninjapi-tui.service > /dev/null << 'EOF'
[Unit]
Description=NinjaPi TUI Display
After=multi-user.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ninjapi-tui
ExecStart=/home/pi/ninjapi-tui/ninjapi-tui
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
Environment=TERM=linux
Environment=DISPLAY=:0

[Install]
WantedBy=multi-user.target
EOF

# 6. Update /etc/rc.local
echo "📝 Backing up and updating /etc/rc.local..."
sudo cp /etc/rc.local /etc/rc.local.backup 2>/dev/null || true

sudo tee /etc/rc.local > /dev/null << 'EOF'
#!/bin/sh -e
# Launch NinjaPi TUI on TFT display

# Wait for system to settle
sleep 5

# Set console font for better readability on small screen
setfont /usr/share/consolefonts/Lat15-Terminus12x6.psf.gz 2>/dev/null || true

# Switch to framebuffer console and launch TUI
sudo -u pi /home/pi/launch-tui.sh &

exit 0
EOF

sudo chmod +x /etc/rc.local

# 7. Write build and install script
echo "📝 Writing build-and-install.sh..."
sudo tee /home/pi/ninjapi-tui/build-and-install.sh > /dev/null << 'EOF'
#!/bin/bash
# Build and install NinjaPi TUI

set -e

cd /home/pi/ninjapi-tui

echo "🔧 Installing Go dependencies..."
go mod tidy

echo "🏗️  Building application..."
go build -o ninjapi-tui *.go

echo "🔐 Making executable..."
chmod +x ninjapi-tui

echo "⚙️  Enabling systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable ninjapi-tui.service

echo "✅ Build complete!"
echo ""
echo "To test now:"
echo "  ./ninjapi-tui"
echo ""
echo "For button testing (while TUI is running):"
echo "  kill -USR1 \$(pgrep ninjapi-tui)  # Simulate button 1"
echo "  kill -USR2 \$(pgrep ninjapi-tui)  # Simulate button 2"
echo ""
echo "To start service:"
echo "  sudo systemctl start ninjapi-tui.service"
echo ""
echo "Reboot to see auto-launch on TFT display"
EOF

sudo chmod +x /home/pi/ninjapi-tui/build-and-install.sh

# 8. Write test script
echo "📝 Writing test-buttons.sh..."
sudo tee /home/pi/ninjapi-tui/test-buttons.sh > /dev/null << 'EOF'
#!/bin/bash
# Test button simulation

PID=$(pgrep ninjapi-tui)

if [ -z "$PID" ]; then
    echo "❌ NinjaPi TUI not running. Start it first with: ./ninjapi-tui"
    exit 1
fi

echo "🎮 Testing buttons for PID: $PID"
echo "Press Ctrl+C to stop testing"

while true; do
    echo "Pressing Button 1..."
    kill -USR1 $PID
    sleep 2
    
    echo "Pressing Button 2..."
    kill -USR2 $PID
    sleep 2
done
EOF

sudo chmod +x /home/pi/ninjapi-tui/test-buttons.sh

# Set ownership to pi user
echo "🔧 Setting ownership..."
sudo chown -R pi:pi /home/pi/ninjapi-tui/
sudo chown pi:pi /home/pi/launch-tui.sh

# Final instructions
echo ""
echo "✅ Setup complete! All files written to:"
echo "   📁 /home/pi/ninjapi-tui/"
echo "   📁 /home/pi/launch-tui.sh"
echo "   📁 /etc/systemd/system/ninjapi-tui.service"
echo "   📁 /etc/rc.local (backed up to /etc/rc.local.backup)"
echo ""
echo "🚀 Next steps:"
echo "   1. cd /home/pi/ninjapi-tui"
echo "   2. ./build-and-install.sh"
echo "   3. ./ninjapi-tui                    # Test the TUI"
echo "   4. ./test-buttons.sh               # Test button simulation (in another terminal)"
echo ""
echo "🔌 GPIO Wiring (adjust pins in gpio.go if needed):"
echo "   Button 1: GPIO 17 (Pin 11) to GND"
echo "   Button 2: GPIO 27 (Pin 13) to GND"
echo ""
echo "🔄 Auto-start options:"
echo "   Option A: sudo systemctl start ninjapi-tui.service"
echo "   Option B: Reboot (will auto-launch via /etc/rc.local)"
EOF