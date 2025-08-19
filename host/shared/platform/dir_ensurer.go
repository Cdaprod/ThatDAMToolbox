package platform

// DirEnsurer defines an interface for ensuring directories are present
// with the desired ownership and permissions.
type DirEnsurer interface {
	EnsureDirs([]FileSpec) error
}

// OSDirEnsurer uses the host operating system to ensure directories.
type OSDirEnsurer struct{}

// EnsureDirs delegates to the package-level EnsureDirs function.
func (OSDirEnsurer) EnsureDirs(specs []FileSpec) error {
	return EnsureDirs(specs)
}

// NewOSDirEnsurer returns a DirEnsurer backed by the host OS implementation.
func NewOSDirEnsurer() DirEnsurer {
	return OSDirEnsurer{}
}
