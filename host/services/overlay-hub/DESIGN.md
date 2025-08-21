# overlay-hub Design

The overlay-hub tracks agent registrations and heartbeats in memory only. No registry data or session metadata is written to disk or external storage. When the process exits or restarts, all stored information is lost and a fresh registry is built from incoming requests.

This design keeps the service stateless beyond its runtime, ensuring each launch starts with an empty in-memory registry and no persisted state.
