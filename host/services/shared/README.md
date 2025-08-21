# shared

Reusable Go packages for ThatDAM services.

## Storage

The `storage` package defines a minimal `BlobStore` interface and a filesystem
implementation.

```go
bs := storage.NewFS("/tmp/data", platform.NewOSDirEnsurer())
_ = bs.Put("foo/bar.txt", strings.NewReader("hello"))
```

## Catalog

The `catalog` package exposes `Asset` metadata and the `Catalog` interface.

```go
var c catalog.Catalog // provided by supervisor
assets, _ := c.ListByFolder("recordings", 1, 10)
```

## Bootstrap

The `bootstrap` module provides lightweight service runtime adapters. The
`runtime_docker` adapter now uses `docker inspect` to populate `UnitState` with
the container's running status, PID, and exit code.

## Bus

The `bus` package offers a minimal publish/subscribe API with pluggable
adapters. In addition to the default AMQP adapter, `bus/log` provides a
file-backed, append-only log for Kafka-like sequential I/O patterns.

```go
log.Register()
b, _ := bus.Connect(context.Background(), bus.Config{URL: "/tmp/bus", Exchange: "events"})
_ = b.Publish("topic", []byte("msg"))
```
## Tenancy

The `tenant` package defines interfaces used to scope requests to a tenant.

```go
var r tenant.TenantContextResolverPort
tenantID, principalID, _ := r.Resolve(ctx, req)
```

`TenantDirectoryPort` looks up tenants, `MembershipPort` checks principal access,
and `TenantContextResolverPort` extracts tenant context from requests.

## Stream

The `stream` package negotiates device streaming sessions across protocols.
It now includes an `srt` adapter that builds SRT URLs with a `streamid`
query parameter.
