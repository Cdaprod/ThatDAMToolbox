// Package platform provides low-level host primitives.
//
// EnsureDirs creates directories with the specified ownership and mode.
// The operation is idempotent and safe to call multiple times.
//
// Example:
//
//	err := platform.EnsureDirs([]platform.FileSpec{
//	    {Path: "/var/lib/thatdamtoolbox/db", UID: 1000, GID: 16000, Mode: 0o2775},
//	})
//	if err != nil { log.Fatal(err) }
package platform

import (
	"errors"
	"fmt"
	"os"
)

// DirEnsurer ensures directories exist with the specified ownership and mode.
type DirEnsurer interface {
	EnsureDirs([]FileSpec) error
}

// NewOSDirEnsurer returns a DirEnsurer backed by the local filesystem.
func NewOSDirEnsurer() DirEnsurer { return osDirEnsurer{} }

type osDirEnsurer struct{}

func (osDirEnsurer) EnsureDirs(specs []FileSpec) error { return EnsureDirs(specs) }

// FileSpec describes a directory to ensure.
type FileSpec struct {
	Path string      // absolute path to directory
	UID  int         // user ID for ownership
	GID  int         // group ID for ownership
	Mode os.FileMode // permission bits (e.g. 0o2775)
}

// EnsureDirs ensures each directory in specs exists with given ownership and mode.
// It continues on individual errors and returns a joined error at the end.
func EnsureDirs(specs []FileSpec) error {
	var errs error
	for _, s := range specs {
		if err := os.MkdirAll(s.Path, s.Mode); err != nil {
			errs = errors.Join(errs, fmt.Errorf("mkdir %s: %w", s.Path, err))
			continue
		}
		if err := os.Chown(s.Path, s.UID, s.GID); err != nil {
			errs = errors.Join(errs, fmt.Errorf("chown %s: %w", s.Path, err))
		}
		if err := os.Chmod(s.Path, s.Mode); err != nil {
			errs = errors.Join(errs, fmt.Errorf("chmod %s: %w", s.Path, err))
		}
	}
	return errs
}
