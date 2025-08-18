package ports

import "github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"

// CatalogProvider exposes the metadata catalog.
type CatalogProvider interface {
	Catalog() catalog.Catalog
}
