// /host/services/capture-daemon/runner/control.go
package runner

import (
	"context"
)

// RunnerControl is handed back to the registry so it can stop a capture loop.
type RunnerControl struct {
	StopChan chan struct{}
}

// StartRunner spins up an ffmpeg capture loop for `device` and returns control
// back to the caller.
func StartRunner(device string) RunnerControl {
	stop := make(chan struct{})

	go func() {
		ctx, cancel := context.WithCancel(context.Background())
		go func() {
			<-stop
			cancel()
		}()

		// Run until ctx is canceled
		_ = RunCaptureLoop(ctx, DefaultConfig(device))
	}()

	return RunnerControl{StopChan: stop}
}
