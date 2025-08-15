# Runner: Deterministic Delivery

- Fetch plan and profile from Supervisor
- Reduce to a canonical App via `CreateApp`
- Hash for drift detection
- Apply via selected executor (`docker`, `nerdctl`, `systemd`, `noop`)
- Heartbeat on success

Install script example:
```bash
SUPERVISOR_URL=http://localhost:8070 ./scripts/install-runner.sh
```
