# Runner: Deterministic Delivery

- Fetch plan and profile from Supervisor
- Reduce to a canonical App via `CreateApp`
- Hash for drift detection
- Apply via selected executor (`docker`, `nerdctl`, `systemd`, `noop`)
- Heartbeat on success

Install script example:
```bash
./scripts/install-runner.sh --supervisor http://localhost:8070 \
  --executor docker \
  --claim "$(curl -fsSL http://localhost:8070/v1/runner/claim?node_id=$(hostname))" \
  --role-hint edge --labels gpu
```

The script writes its configuration to `/etc/cda/runner.env` and installs a
systemd unit that sources this file.
