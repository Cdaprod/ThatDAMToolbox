package rtp

import (
	"testing"
	"time"

	prtp "github.com/pion/rtp"
)

type fakeClock struct{ now time.Time }

func (f *fakeClock) Now() time.Time        { return f.now }
func (f *fakeClock) Sleep(d time.Duration) { f.now = f.now.Add(d) }

type mockConn struct {
	clock *fakeClock
	times []time.Time
	seqs  []uint16
}

func (m *mockConn) Write(b []byte) (int, error) {
	var pkt prtp.Packet
	_ = pkt.Unmarshal(b)
	m.times = append(m.times, m.clock.Now())
	m.seqs = append(m.seqs, pkt.SequenceNumber)
	return len(b), nil
}
func (m *mockConn) Close() error { return nil }

func TestSenderPacingAndOrder(t *testing.T) {
	fc := &fakeClock{now: time.Unix(0, 0)}
	mc := &mockConn{clock: fc}
	s := &Sender{cfg: Config{ClockRate: 90000}, conn: mc, clock: fc}

	pkts := []*prtp.Packet{
		{Header: prtp.Header{Timestamp: 0, SequenceNumber: 1}},
		{Header: prtp.Header{Timestamp: 3000, SequenceNumber: 2}},
		{Header: prtp.Header{Timestamp: 6000, SequenceNumber: 3}},
	}

	for _, p := range pkts {
		if err := s.Send(p); err != nil {
			t.Fatalf("send: %v", err)
		}
	}

	if len(mc.times) != 3 {
		t.Fatalf("expected 3 packets, got %d", len(mc.times))
	}
	interval := mc.times[1].Sub(mc.times[0])
	expected := time.Second / 30
	if interval != expected {
		t.Fatalf("interval = %v, want %v", interval, expected)
	}
	for i := 1; i < len(mc.seqs); i++ {
		if mc.seqs[i] != mc.seqs[i-1]+1 {
			t.Fatalf("sequence out of order: %v", mc.seqs)
		}
	}
}
