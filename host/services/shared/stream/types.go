package stream

// Device describes a capture device and available protocols.
type Device struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Streams []Stream `json:"streams"`
}

// Stream describes a protocol option.
type Stream struct {
	Proto  string   `json:"proto"`
	Codecs []string `json:"codecs,omitempty"`
}

// Request initiates a streaming session.
type Request struct {
	Device string   `json:"device"`
	Prefer []string `json:"prefer"`
}

// Session returned to the caller.
type Session struct {
	ID       string         `json:"session_id"`
	Proto    string         `json:"proto"`
	Details  map[string]any `json:"details"`
	Fallback []string       `json:"fallback,omitempty"`
}

// Capabilities lists protocol support for a device.
type Capabilities struct {
	Protos []string
}

func (c Capabilities) Has(p string) bool {
	for _, v := range c.Protos {
		if v == p {
			return true
		}
	}
	return false
}
