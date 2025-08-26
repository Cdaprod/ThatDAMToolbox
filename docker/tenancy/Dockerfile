# Dockerfile for Tenancy service
# Example:
#   docker build -t thatdamtoolbox/tenancy -f docker/tenancy/Dockerfile .

ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS build
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
WORKDIR /src
COPY go.work go.work.sum ./
COPY host/shared/ host/shared/
COPY host/services/tenancy/ host/services/tenancy/
RUN go work sync && go build -o /tenancy ./host/services/tenancy/cmd/tenancy

FROM alpine:3.20 AS runtime
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/ThatDAMToolbox" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - tenancy" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG \
      org.opencontainers.image.licenses="Apache-2.0"
RUN apk add --no-cache curl
COPY --from=build /tenancy /usr/local/bin/tenancy
EXPOSE 8082
ENTRYPOINT ["/usr/local/bin/tenancy"]
