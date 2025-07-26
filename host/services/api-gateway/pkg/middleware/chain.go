// /host/services/api-gateway/pkg/middleware/chain.go
package middleware

import "net/http"

// Middleware represents a middleware function
type Middleware func(http.Handler) http.Handler

// Chain represents a chain of middleware
type Chain struct {
    middlewares []Middleware
}

// New creates a new middleware chain
func New(middlewares ...Middleware) *Chain {
    return &Chain{middlewares: middlewares}
}

// Use adds a middleware to the chain
func (c *Chain) Use(middleware Middleware) *Chain {
    c.middlewares = append(c.middlewares, middleware)
    return c
}

// Build creates the final handler with all middleware applied
func (c *Chain) Build(handler http.Handler) http.Handler {
    // Apply middleware in reverse order (last added runs first)
    for i := len(c.middlewares) - 1; i >= 0; i-- {
        handler = c.middlewares[i](handler)
    }
    return handler
}