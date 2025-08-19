# runner

A small agent that fetches plans from the supervisor and applies them deterministically.

## Usage

```bash
SUPERVISOR_URL=http://localhost:8070 RUNNER_EXECUTOR=docker \
  go run ./host/services/runner/cmd/runner
```

The runner contacts the supervisor for a `DesiredPlan` describing apps to run.
Apps are started in dependency order using the `after` field.

## Install (systemd)

```bash
SUPERVISOR_URL=http://localhost:8070 RUNNER_EXECUTOR=docker \
  sudo bash scripts/install-runner.sh
```

## Tests

```bash
go test ./host/services/runner/...
```
