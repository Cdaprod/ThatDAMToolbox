package main

// Command tenancy runs the tenancy HTTP service.
//
// Example:
//     go run ./cmd/tenancy/main.go
//
// curl example:
//     curl -X POST http://localhost:8082/login -H "X-User-ID: user1"

import (
    "flag"
    "log"
    "net/http"

    "github.com/Cdaprod/ThatDamToolbox/host/services/tenancy"
)

var version = "dev"

func main() {
    addr := flag.String("addr", ":8082", "listen address")
    flag.Parse()

    svc := tenancy.NewService(tenancy.RolePolicy{})
    log.Printf("tenancy service %s listening on %s", version, *addr)
    if err := http.ListenAndServe(*addr, tenancy.NewServer(svc)); err != nil {
        log.Fatal(err)
    }
}

