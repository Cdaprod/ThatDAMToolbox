# Use the official RabbitMQ image with the management UI baked in
FROM rabbitmq:3.9-management

# Enable the Prometheus plugin (for /metrics) and any other you wish
RUN rabbitmq-plugins enable --offline \
      rabbitmq_prometheus \
      rabbitmq_peer_discovery_classic_config

# Copy in our custom config and pre-defined topology
COPY rabbitmq.conf        /etc/rabbitmq/rabbitmq.conf
COPY definitions.json     /etc/rabbitmq/definitions.json

# Expose Prometheus metrics port
EXPOSE 9419