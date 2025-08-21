// Package rtp provides a simple RTP sender paced by PTP time.
//
// Example:
//
// cfg := rtp.Config{Destination: "239.1.1.1:5004", Multicast: true, ClockRate: 90000}
// s, _ := rtp.NewSender(cfg)
// defer s.Close()
// s.Send(&rtp.Packet{Timestamp: 0, SequenceNumber: 1})
package rtp

import (
	"net"
	"time"

	prtp "github.com/pion/rtp"
)

// Clock provides PTP-synchronized time and sleep functionality.
type Clock interface {
	Now() time.Time
	Sleep(d time.Duration)
}

// SystemClock uses the system wall clock, assumed to be PTP-synchronized.
type SystemClock struct{}

func (SystemClock) Now() time.Time        { return time.Now() }
func (SystemClock) Sleep(d time.Duration) { time.Sleep(d) }

// Config defines RTP sender settings.
type Config struct {
	// Destination is the host:port of the target.
	Destination string
	// Multicast enables multicast-specific socket options.
	Multicast bool
	// ClockRate is the RTP clock rate (e.g. 90000 for video).
	ClockRate int
	// JitterBuffer adds a constant delay to absorb network jitter.
	JitterBuffer time.Duration
	// Clock provides timing; defaults to SystemClock.
	Clock Clock
}

// writeCloser abstracts net.Conn for testing.
type writeCloser interface {
	Write([]byte) (int, error)
	Close() error
}

// Sender writes RTP packets with 2110-21 style pacing.
type Sender struct {
	cfg      Config
	conn     writeCloser
	clock    Clock
	baseRTP  uint32
	baseTime time.Time
}

// NewSender creates a paced RTP sender using UDP.
func NewSender(cfg Config) (*Sender, error) {
	addr, err := net.ResolveUDPAddr("udp", cfg.Destination)
	if err != nil {
		return nil, err
	}
	conn, err := net.DialUDP("udp", nil, addr)
	if err != nil {
		return nil, err
	}
	clk := cfg.Clock
	if clk == nil {
		clk = SystemClock{}
	}
	return &Sender{cfg: cfg, conn: conn, clock: clk}, nil
}

// Close stops the sender.
func (s *Sender) Close() error { return s.conn.Close() }

// Send transmits an RTP packet paced by PTP time.
func (s *Sender) Send(pkt *prtp.Packet) error {
	if s.baseTime.IsZero() {
		s.baseTime = s.clock.Now()
		s.baseRTP = pkt.Timestamp
	}
	elapsedRTP := pkt.Timestamp - s.baseRTP
	elapsed := time.Duration(int64(elapsedRTP)) * time.Second / time.Duration(s.cfg.ClockRate)
	target := s.baseTime.Add(elapsed + s.cfg.JitterBuffer)
	if wait := target.Sub(s.clock.Now()); wait > 0 {
		s.clock.Sleep(wait)
	}
	b, err := pkt.Marshal()
	if err != nil {
		return err
	}
	_, err = s.conn.Write(b)
	return err
}
