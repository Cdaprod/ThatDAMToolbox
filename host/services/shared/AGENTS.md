# shared – AGENTS Guide

Scope: Common Go packages and middleware reused by host services.

- Keep packages generic; no service-specific logic or configuration.
- Import via module path `host/services/shared/...` only.
- Each subpackage needs focused unit tests and clear docs.
- Avoid global state; expose explicit constructors and interfaces.
- Update this file and README when adding new packages.
- `bus/log` implements an append-only, file-backed bus adapter for
  Kafka-like sequential I/O.
- `ptp` offers a monotonic clock with optional PTP offset; instantiate a
  `Clock` and avoid package-level globals.
