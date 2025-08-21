# Tests

Go-based latency and jitter checks for streaming transports.

## Running

```bash
go test ./tests -run TestTransportLatency -v
```

The test simulates a camera feed flowing through an encoder, transport, and
viewer using synthetic fixtures. It asserts that each transport meets its
latency and jitter thresholds (WebRTC <200 ms, SRT <200 ms, RTP/PTP <10 ms).
