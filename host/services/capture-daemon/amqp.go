package main

import (
	"encoding/json"
	"log"
	"os"

	"github.com/streadway/amqp"
)

// one lazy-initialised channel shared by the whole process
var ch *amqp.Channel

func initAMQP() {
	url := os.Getenv("AMQP_URL") // → docker-compose passes this
	if url == "" {
		log.Println("[amqp] AMQP_URL not set – running in in-proc mode")
		return
	}
	conn, err := amqp.Dial(url)
	if err != nil {
		log.Fatalf("[amqp] dial %s: %v", url, err)
	}
	c, err := conn.Channel()
	if err != nil {
		log.Fatalf("[amqp] channel: %v", err)
	}
	ch = c
	log.Printf("[amqp] connected → %s", url)
}

// publish() is safe to call even when AMQP not configured
func publish(topic string, payload any) {
	if ch == nil {
		return
	}
	body, _ := json.Marshal(map[string]any{
		"topic":   topic,
		"payload": payload,
	})
	// default (nameless) exchange; routing-key == topic
	err := ch.Publish("", topic, false, false,
		amqp.Publishing{ContentType: "application/json", Body: body})
	if err != nil {
		log.Printf("[amqp] publish %s: %v", topic, err)
	}
}