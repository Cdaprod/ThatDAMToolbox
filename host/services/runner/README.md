# runner

A small agent that fetches plans from the supervisor and applies them deterministically.

## Usage

```bash
SUPERVISOR_URL=http://localhost:8070 RUNNER_EXECUTOR=noop go run ./host/services/runner/cmd/runner
```

## Install (systemd)

```bash
SUPERVISOR_URL=http://localhost:8070 RUNNER_EXECUTOR=noop sudo bash scripts/install-runner.sh
```

## Tests

```bash
go test ./host/services/runner/...
```
