# Use the official RabbitMQ image with the management UI baked in
FROM rabbitmq:3.13-management
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - rabbitmq" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG

# Enable the Prometheus plugin (for /metrics) and any other you wish
# (removed: rabbitmq_peer_discovery_classic_config)
RUN rabbitmq-plugins enable --offline rabbitmq_prometheus 



# Copy in our custom config and pre-defined topology
COPY rabbitmq.conf        /etc/rabbitmq/rabbitmq.conf
COPY definitions.json     /etc/rabbitmq/definitions.json

# Wrapper entrypoint to auto-enable required feature flags
COPY entrypoint.sh /usr/local/bin/rabbitmq-entrypoint.sh
RUN chmod +x /usr/local/bin/rabbitmq-entrypoint.sh

# Expose Prometheus metrics port
EXPOSE 9419
