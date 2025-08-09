// /host/services/media-api/pkg/plugins/plugin.go
// Package plugins declares the Module interface for extensions.
// Example:
//
//	func (m *MyModule) RegisterRoutes(mux *http.ServeMux) {}
package plugins

import (
	"flag"
	"net/http"
)

// Module is implemented by plug-ins that extend the media API.
type Module interface {
	// RegisterRoutes allows a module to attach HTTP routes.
	RegisterRoutes(mux *http.ServeMux)
	// RegisterCLI allows a module to add CLI flags or subcommands.
	RegisterCLI(fs *flag.FlagSet)
}
