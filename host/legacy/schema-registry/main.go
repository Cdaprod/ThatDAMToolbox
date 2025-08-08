package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	_ "modernc.org/sqlite"
)

type SchemaDef struct {
	Topic       string          `json:"topic"`
	Description string          `json:"description"`
	Schema      json.RawMessage `json:"schema"`
}

type SchemaEvent struct {
	Service   string      `json:"service"`
	Version   string      `json:"version"`
	Timestamp string      `json:"timestamp"`
	Schemas   []SchemaDef `json:"schemas"`
}

func main() {
	// 1) connect to RabbitMQ
	conn, err := amqp.Dial("amqp://video:video@rabbitmq:5672/")
	if err != nil {
		log.Fatalf("AMQP dial: %v", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("Channel: %v", err)
	}
	defer ch.Close()

	const exch = "events"
	// 2) declare a temporary queue and bind to our schemas topic
	q, err := ch.QueueDeclare("", true, true, false, false, nil)
	if err != nil {
		log.Fatalf("QueueDeclare: %v", err)
	}
	if err := ch.QueueBind(q.Name, "events.schemas", exch, false, nil); err != nil {
		log.Fatalf("QueueBind: %v", err)
	}

	msgs, err := ch.Consume(q.Name, "", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Consume: %v", err)
	}

	// 3) open (or create) the SQLite DB beside this binary
	db, err := sql.Open("sqlite", "./schemas.db")
	if err != nil {
		log.Fatalf("sqlite open: %v", err)
	}
	defer db.Close()

	// 4) ensure our table exists
	_, err = db.Exec(`
      CREATE TABLE IF NOT EXISTS schemas (
        topic       TEXT PRIMARY KEY,
        service     TEXT,
        version     TEXT,
        description TEXT,
        schema      JSON,
        updated     TIMESTAMP
      );
    `)
	if err != nil {
		log.Fatalf("table create: %v", err)
	}

	log.Println("🚀 Schema‐registry: awaiting events.schemas…")
	for d := range msgs {
		var e SchemaEvent
		if err := json.Unmarshal(d.Body, &e); err != nil {
			log.Printf("❌ unmarshal: %v", err)
			continue
		}
		for _, s := range e.Schemas {
			if _, err := db.Exec(`
                INSERT INTO schemas(topic, service, version, description, schema, updated)
                VALUES(?,?,?,?,?,?)
                ON CONFLICT(topic) DO UPDATE SET
                  service     = excluded.service,
                  version     = excluded.version,
                  description = excluded.description,
                  schema      = excluded.schema,
                  updated     = excluded.updated;
            `, s.Topic, e.Service, e.Version, s.Description, s.Schema, time.Now()); err != nil {
				log.Printf("❌ db write %s: %v", s.Topic, err)
			} else {
				log.Printf("✅ stored schema %s from %s", s.Topic, e.Service)
			}
		}
	}
}
