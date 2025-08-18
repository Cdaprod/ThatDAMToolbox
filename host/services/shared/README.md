# shared

Reusable Go packages for ThatDAM services.

## Storage

The `storage` package defines a minimal `BlobStore` interface and a filesystem
implementation.

```go
bs := storage.NewFS("/tmp/data")
_ = bs.Put("foo/bar.txt", strings.NewReader("hello"))
```

## Catalog

The `catalog` package exposes `Asset` metadata and the `Catalog` interface.

```go
var c catalog.Catalog // provided by supervisor
assets, _ := c.ListByFolder("recordings", 1, 10)
```
