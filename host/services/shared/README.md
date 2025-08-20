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

## Bus

The `bus` package offers a minimal publish/subscribe API with pluggable
adapters. In addition to the default AMQP adapter, `bus/log` provides a
file-backed, append-only log for Kafka-like sequential I/O patterns.

```go
log.Register()
b, _ := bus.Connect(context.Background(), bus.Config{URL: "/tmp/bus", Exchange: "events"})
_ = b.Publish("topic", []byte("msg"))
```
