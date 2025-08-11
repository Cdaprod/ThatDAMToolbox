// Package scanner previously implemented a local system scanner. The logic now
// lives in the shared module; this file remains so existing imports continue to
// compile and to pull in the shared V4L2 scanner via blank import.
package scanner

import _ "github.com/Cdaprod/ThatDamToolbox/host/services/shared/scanner/v4l2"
