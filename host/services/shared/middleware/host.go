// ================================
// HOST MIDDLEWARE (System Level)
// ================================

package host

import (
    "context"
    "fmt"
    "log"
    "net/http"
    "os"
    "runtime"
    "syscall"
    "time"
)

// SystemResourceMiddleware monitors system resources and blocks requests if resources are low
func SystemResourceMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Check memory usage
        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        
        // Check disk space
        var stat syscall.Statfs_t
        syscall.Statfs("/", &stat)
        availableGB := float64(stat.Bavail*uint64(stat.Bsize)) / 1024 / 1024 / 1024
        
        // Block if resources are critically low
        if m.Alloc > 500*1024*1024 || availableGB < 1.0 { // 500MB RAM or 1GB disk
            http.Error(w, "System resources critically low", http.StatusServiceUnavailable)
            log.Printf("RESOURCE WARNING: RAM: %d MB, Disk: %.1f GB", 
                m.Alloc/1024/1024, availableGB)
            return
        }
        
        // Add resource info to context
        ctx := context.WithValue(r.Context(), "system_stats", map[string]interface{}{
            "ram_mb":      m.Alloc / 1024 / 1024,
            "disk_gb":     availableGB,
            "goroutines":  runtime.NumGoroutine(),
        })
        
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// ProcessLimitMiddleware limits concurrent connections per process
func ProcessLimitMiddleware(maxConnections int) func(http.Handler) http.Handler {
    semaphore := make(chan struct{}, maxConnections)
    
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            select {
            case semaphore <- struct{}{}:
                defer func() { <-semaphore }()
                next.ServeHTTP(w, r)
            default:
                http.Error(w, "Server overloaded", http.StatusServiceUnavailable)
            }
        })
    }
}

// FileSystemMiddleware checks if required directories exist and are writable
func FileSystemMiddleware(requiredPaths []string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            for _, path := range requiredPaths {
                if _, err := os.Stat(path); os.IsNotExist(err) {
                    http.Error(w, fmt.Sprintf("Required path not found: %s", path), 
                        http.StatusServiceUnavailable)
                    return
                }
                
                // Check if writable
                testFile := path + "/.write_test"
                if f, err := os.Create(testFile); err != nil {
                    http.Error(w, fmt.Sprintf("Path not writable: %s", path), 
                        http.StatusServiceUnavailable)
                    return
                } else {
                    f.Close()
                    os.Remove(testFile)
                }
            }
            next.ServeHTTP(w, r)
        })
    }
}