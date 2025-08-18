I’ll show you Go middleware examples for different layers of your architecture. Here are practical implementations:​​​​​​​​​​​​​​

(See the files in this directory)​

Now let me show you how to wire these middleware together in a practical application:​​​​​​​​​​​​​​​ (See the file at [api-gateway](/host/services/api-gateway/cmd/main.go).

## JWT Authentication

The backend middleware verifies JSON Web Tokens signed with a shared secret.
Set the secret via the `JWT_SECRET` environment variable:

```bash
export JWT_SECRET="change-me"
```

Tokens must include `sub`, `username`, `role` and an `exp` claim. Requests with invalid or expired tokens are rejected with HTTP 401.
Minimal token creation example:

```go
token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
    "sub": "123",
    "username": "alice",
    "role": "user",
    "exp": time.Now().Add(time.Hour).Unix(),
})
signed, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
```

## Key Differences by Layer:

### **Host Middleware** (System/Infrastructure Level)

- **Purpose**: Manages system resources, process limits, file system checks
- **Examples**: Memory monitoring, disk space checks, connection limits
- **When it runs**: Before any application logic
- **Typical concerns**: Hardware resources, OS-level limits, system health

### **Backend Middleware** (API/Business Logic Level)

- **Purpose**: Handles API concerns like auth, routing, caching, rate limiting
- **Examples**: JWT validation, request logging, API gateway routing
- **When it runs**: After system checks, before frontend processing
- **Typical concerns**: Authentication, business rules, data processing

### **Frontend Middleware** (UI/Presentation Level)

- **Purpose**: Manages static assets, SPA routing, security headers, compression
- **Examples**: Static file serving, CSP headers, gzip compression
- **When it runs**: Last layer before serving content to users
- **Typical concerns**: User experience, security, performance optimization

## For Your Video System Specifically:

```go
// This would be your main middleware stack for the camera monitoring system
func videoSystemMiddleware(handler http.Handler) http.Handler {
    return host.SystemResourceMiddleware(                     // Check system resources
        host.FileSystemMiddleware([]string{"/data/media"})(   // Ensure media dir exists
            backend.APIGatewayMiddleware(map[string]string{   // Route to Python backend
                "/api/": "http://localhost:8000",
            })(
                MediaStreamingMiddleware("/data/media")(      // Handle video streaming
                    WebSocketUpgradeMiddleware(               // WebSocket for live feeds
                        frontend.StaticFileMiddleware("/static", 24*time.Hour)( // Serve UI assets
                            handler,
                        ),
                    ),
                ),
            ),
        ),
    )
}
```

The middleware chain processes requests from **outside-in** but you define them **inside-out** when chaining. So the outermost middleware (host-level) runs first, then backend, then frontend, then your actual application handler.

This gives you a clean separation of concerns where each layer only worries about its specific responsibilities while building up the complete request processing pipeline.​​​​​​​​​​​​​​​​