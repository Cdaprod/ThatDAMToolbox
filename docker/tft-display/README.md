Absolutely. Here’s a complete, real-world setup for your Pi TFT NINJAPI display, including:
	1.	/etc/rc.local auto-launch for your TUI at boot
	2.	Basic Bubble Tea Go template for a NINJAPI status display
	3.	GPIO button integration to toggle state or trigger actions in your TUI

Everything is detailed, minimal, and robust for embedded use.

⸻

1. /etc/rc.local for Auto-Launching TUI on Boot

The easiest way to get your TUI running on your TFT display at boot without X11 or desktop is to use rc.local. This ensures it launches on tty1 (your TFT after the fbcon=map:10 setup).

/etc/rc.local

#!/bin/bash
# Wait for everything to settle
sleep 5
# Switch to root home (optional)
cd /root

# Switch to VT1 (your TFT), then run fbterm and your app as 'pi' user
sudo -u pi sh -c '
  export HOME=/home/pi
  export PATH=$PATH:/usr/local/go/bin
  chvt 1
  fbterm -s 16 -- bash -c "cd /home/pi/ninjapi-tui && ./ninjamgr"
' &

exit 0

	•	Replace /home/pi/ninjapi-tui and ./ninjamgr with your actual binary path/name.
	•	Note: Make sure your TUI app is built for armv7/arm64 and executable (chmod +x ninjamgr).

⸻

2. Basic Bubble Tea Template: ninjamgr.go

This is a minimal Bubble Tea app showing a NINJAPI status, and a toggle (to be triggered by a GPIO pin press):

/home/pi/ninjapi-tui/ninjamgr.go

package main

import (
    "fmt"
    tea "github.com/charmbracelet/bubbletea"
    "os"
    "os/signal"
    "syscall"
)

type model struct {
    toggled bool
}

type toggleMsg bool

func (m model) Init() tea.Cmd {
    // Start listening for GPIO toggle in a goroutine
    return waitForToggle
}

func waitForToggle() tea.Msg {
    // This goroutine will block until a GPIO event is detected (see next step)
    // Here, you would use a channel from GPIO, for demo we'll fake with signals
    c := make(chan os.Signal, 1)
    signal.Notify(c, syscall.SIGUSR1) // Use SIGUSR1 to simulate GPIO
    <-c
    return toggleMsg(true)
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case toggleMsg:
        m.toggled = !m.toggled
        // Wait for next toggle
        return m, waitForToggle
    case tea.KeyMsg:
        switch msg.String() {
        case "ctrl+c", "q":
            return m, tea.Quit
        }
    }
    return m, nil
}

func (m model) View() string {
    status := "OFF"
    if m.toggled {
        status = "ON"
    }
    return fmt.Sprintf(`
    NINJAPI Status Display

    Recording: [%s]

    (Press hardware button to toggle, or send SIGUSR1 for demo)
    Press 'q' or Ctrl+C to quit.
    `, status)
}

func main() {
    p := tea.NewProgram(model{})
    if err := p.Start(); err != nil {
        fmt.Println("Error running NINJAPI TUI:", err)
        os.Exit(1)
    }
}

	•	For demo, toggling works by sending SIGUSR1 to the process:
kill -SIGUSR1 <pid>
	•	Replace this with GPIO trigger code (below).

⸻

3. GPIO + Bubble Tea Integration (Button Trigger)

You want to toggle status (e.g., Recording) with a physical button (e.g., GPIO17, pin 11).

Use periph.io or github.com/stianeikeland/go-rpio:

/home/pi/ninjapi-tui/gpio_toggle.go

package main

import (
    "github.com/stianeikeland/go-rpio/v4"
    "time"
)

const buttonPin = 17 // BCM numbering

func watchButtonToggle(toggleChan chan<- bool) {
    err := rpio.Open()
    if err != nil {
        panic(err)
    }
    pin := rpio.Pin(buttonPin)
    pin.Input()
    pin.PullUp()

    last := pin.Read()
    for {
        current := pin.Read()
        if last == rpio.High && current == rpio.Low {
            // Button pressed (falling edge)
            toggleChan <- true
            time.Sleep(200 * time.Millisecond) // Debounce
        }
        last = current
        time.Sleep(10 * time.Millisecond)
    }
}

Integrate with Bubble Tea
	•	Create a toggleChan channel.
	•	Start watchButtonToggle(toggleChan) in a goroutine inside your model’s Init().
	•	In your Update(), use a custom toggleMsg whenever the channel receives.

⸻

🔗 How to Build/Run on Pi

go mod init ninjapi-tui
go get github.com/charmbracelet/bubbletea
go get github.com/stianeikeland/go-rpio/v4
go build -o ninjamgr ninjamgr.go gpio_toggle.go
chmod +x ninjamgr


⸻

🚀 What This Gives You
	•	Boots right to a Bubble Tea TUI on your TFT, no desktop needed
	•	Physical button toggles recording/status in real time
	•	Easy to expand: Add more GPIO inputs, display IP, camera state, etc.

⸻

Want a full repo scaffold or wiring diagram for button? Let me know how custom you want to get!