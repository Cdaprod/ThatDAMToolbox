package reconcile

import (
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
	idx "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/adapters/index_mem"
)

// IndexRuntime holds the in-memory Catalog implementation.
type IndexRuntime struct{ cat catalog.Catalog }

// BuildIndex constructs the runtime catalog provider.
func BuildIndex() *IndexRuntime { return &IndexRuntime{cat: idx.NewCatalog()} }

// Catalog returns the catalog instance.
func (r *IndexRuntime) Catalog() catalog.Catalog { return r.cat }
