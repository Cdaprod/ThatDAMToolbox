// host/services/capture-daemon/broker/publisher.go
package broker

import (
	"time"
)

// SchemaDescriptor holds the shape for one topic's schema.
type SchemaDescriptor struct {
	Topic       string                 `json:"topic"`
	Description string                 `json:"description"`
	Schema      map[string]interface{} `json:"schema"`
}

// PublishSchemas will emit a single "events.schemas" message
// listing every topic this service can emit.
func PublishSchemas() {
	// (1) Build your full list of schemas here:
	defs := []SchemaDescriptor{
		{
			Topic:       "capture.device_list",
			Description: "Current set of discovered capture devices",
			Schema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id": map[string]interface{}{"type": "string"},
					"path": map[string]interface{}{"type": "string"},
					"name": map[string]interface{}{"type": "string"},
					"status": map[string]interface{}{"type": "string"},
					"last_seen": map[string]interface{}{
						"type":   "string",
						"format": "date-time",
					},
					"capabilities": map[string]interface{}{"type": "object"},
				},
			},
		},
		{
			Topic:       "capture.recording_started",
			Description: "Emitted when a capture loop begins recording",
			Schema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"device":    map[string]interface{}{"type": "string"},
					"file":      map[string]interface{}{"type": "string"},
					"timestamp": map[string]interface{}{"type": "string", "format": "date-time"},
				},
			},
		},
		{
			Topic:       "capture.recording_stopped",
			Description: "Emitted when a capture loop stops recording",
			Schema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"device":    map[string]interface{}{"type": "string"},
					"file":      map[string]interface{}{"type": "string"},
					"timestamp": map[string]interface{}{"type": "string", "format": "date-time"},
				},
			},
		},
		// …add one entry per event your capture-daemon publishes…
	}

	// (2) Package the envelope
	envelope := map[string]interface{}{
		"service":   "capture-daemon",
		"version":   "v0.1.0",                            // bump when you change schema
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"schemas":   defs,
	}

	// (3) Publish it
	Publish("events.schemas", envelope)
}