package main

import (
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"syscall"
	"unsafe"
)

// Pipeline represents a custom video pipeline
type Pipeline struct {
	ID       int
	Name     string
	FIFOPath string
	DevPath  string // Virtual /dev/videoN if using v4l2loopback

	// Pipeline state
	Active bool
	mutex  sync.RWMutex

	// Frame processing
	FrameHandler func([]byte) []byte
	Subscribers  []chan []byte
}

type PipelineManager struct {
	pipelines map[int]*Pipeline
	mutex     sync.RWMutex
	basePath  string
}

func NewPipelineManager(basePath string) *PipelineManager {
	return &PipelineManager{
		pipelines: make(map[int]*Pipeline),
		basePath:  basePath,
	}
}

// Create a new pipeline with virtual video device
func (pm *PipelineManager) CreatePipeline(id int, name string) (*Pipeline, error) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	if _, exists := pm.pipelines[id]; exists {
		return nil, fmt.Errorf("pipeline %d already exists", id)
	}

	pipeline := &Pipeline{
		ID:          id,
		Name:        name,
		FIFOPath:    filepath.Join(pm.basePath, fmt.Sprintf("pipe_%d", id)),
		DevPath:     fmt.Sprintf("/dev/video%d", 50+id), // Assuming v4l2loopback at video50+
		Subscribers: make([]chan []byte, 0),
	}

	// Create named FIFO
	if err := syscall.Mkfifo(pipeline.FIFOPath, 0666); err != nil && !os.IsExist(err) {
		return nil, fmt.Errorf("failed to create FIFO: %v", err)
	}

	pm.pipelines[id] = pipeline
	return pipeline, nil
}

// Send frame data through pipeline
func (p *Pipeline) SendFrame(data []byte) error {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if !p.Active {
		return fmt.Errorf("pipeline %d not active", p.ID)
	}

	// Process frame if handler exists
	processedData := data
	if p.FrameHandler != nil {
		processedData = p.FrameHandler(data)
	}

	// Send to virtual video device (if using v4l2loopback)
	if err := p.writeToVideoDevice(processedData); err != nil {
		return err
	}

	// Send to subscribers
	for _, sub := range p.Subscribers {
		select {
		case sub <- processedData:
		default:
			// Non-blocking send, drop frame if subscriber is slow
		}
	}

	return nil
}

// Write raw video data to v4l2loopback device
func (p *Pipeline) writeToVideoDevice(data []byte) error {
	file, err := os.OpenFile(p.DevPath, os.O_WRONLY, 0)
	if err != nil {
		return err
	}
	defer file.Close()

	// Write raw frame data (format must match what was configured)
	_, err = file.Write(data)
	return err
}

// Subscribe to pipeline frames
func (p *Pipeline) Subscribe() <-chan []byte {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	ch := make(chan []byte, 10) // Buffered channel
	p.Subscribers = append(p.Subscribers, ch)
	return ch
}

// Start pipeline processing
func (p *Pipeline) Start() error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	p.Active = true

	// Start FIFO reader goroutine
	go p.fifoReader()

	return nil
}

// Read from FIFO and process frames
func (p *Pipeline) fifoReader() {
	file, err := os.OpenFile(p.FIFOPath, os.O_RDONLY, 0)
	if err != nil {
		fmt.Printf("Failed to open FIFO %s: %v\n", p.FIFOPath, err)
		return
	}
	defer file.Close()

	for p.Active {
		// Read frame size first (4 bytes)
		var frameSize uint32
		if err := binary.Read(file, binary.LittleEndian, &frameSize); err != nil {
			if p.Active {
				fmt.Printf("Error reading frame size: %v\n", err)
			}
			break
		}

		// Read frame data
		frameData := make([]byte, frameSize)
		if _, err := file.Read(frameData); err != nil {
			if p.Active {
				fmt.Printf("Error reading frame data: %v\n", err)
			}
			break
		}

		// Process frame
		p.SendFrame(frameData)
	}
}

// Stop pipeline
func (p *Pipeline) Stop() {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	p.Active = false

	// Close all subscriber channels
	for _, sub := range p.Subscribers {
		close(sub)
	}
	p.Subscribers = nil
}

// Custom ioctl-like control for your pipeline
func (p *Pipeline) Control(cmd string, args interface{}) error {
	switch cmd {
	case "set_handler":
		if handler, ok := args.(func([]byte) []byte); ok {
			p.FrameHandler = handler
			return nil
		}
		return fmt.Errorf("invalid handler type")

	case "get_stats":
		// Return pipeline statistics
		stats := map[string]interface{}{
			"id":          p.ID,
			"active":      p.Active,
			"subscribers": len(p.Subscribers),
		}
		if result, ok := args.(*map[string]interface{}); ok {
			*result = stats
			return nil
		}

	default:
		return fmt.Errorf("unknown command: %s", cmd)
	}

	return nil
}

// Example usage in your camera daemon
func main() {
	// Create pipeline manager
	pm := NewPipelineManager("/tmp/video_pipes")

	// Create multiple pipelines
	pipe1, _ := pm.CreatePipeline(1, "camera_feed")
	pipe2, _ := pm.CreatePipeline(2, "processed_feed")

	// Set custom frame handlers
	pipe1.Control("set_handler", func(data []byte) []byte {
		// Your custom processing here
		fmt.Printf("Processing frame of size %d\n", len(data))
		return data
	})

	// Start pipelines
	pipe1.Start()
	pipe2.Start()

	// Your camera daemon would send frames like:
	// pipe1.SendFrame(frameData)

	// Keep running
	select {}
}
