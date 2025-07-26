package middleware

import "net/http"

// Middleware is a func that wraps an http.Handler.
type Middleware func(http.Handler) http.Handler

// Chain holds an ordered list of Middleware.
type Chain struct {
    middlewares []Middleware
}

// New returns an empty Chain.
func New() *Chain {
    return &Chain{middlewares: []Middleware{}}
}

// Use appends a middleware to the chain.
func (c *Chain) Use(m Middleware) *Chain {
    c.middlewares = append(c.middlewares, m)
    return c
}

// Build applies all middlewares in reverse order, returning the final handler.
func (c *Chain) Build(final http.Handler) http.Handler {
    handler := final
    for i := len(c.middlewares) - 1; i >= 0; i-- {
        handler = c.middlewares[i](handler)
    }
    return handler
}