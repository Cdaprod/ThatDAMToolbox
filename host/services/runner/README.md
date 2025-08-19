# runner

A small agent that fetches plans from the supervisor and applies them deterministically.

## Usage

```bash
SUPERVISOR_URL=http://localhost:8070 RUNNER_EXECUTOR=docker \
CLAIM_TOKEN=abcd ROLE_HINT=edge LABELS=cam,alpha \
  go run ./host/services/runner/cmd/runner
```

On first boot, if `CLAIM_TOKEN` is provided the runner posts to
`/api/claims/fulfill` with the token, node id and basic capability info such as
`/dev/video*` devices and GPU hints. Subsequent plan fetches include `role_hint`,
`labels`, and capabilities in the body. The supervisor responds with a
`DesiredPlan` describing apps to run. Apps are started in dependency order using
the `after` field.

## Install (systemd)

```bash
SUPERVISOR_URL=http://localhost:8070 RUNNER_EXECUTOR=docker \
  sudo bash scripts/install-runner.sh
```

## Tests

```bash
go test ./host/services/runner/...
```
