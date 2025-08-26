package tenancy

import (
    "encoding/json"
    "net/http"
    "strings"

    "github.com/google/uuid"
)

// NewServer wires HTTP routes for the tenancy service.
//
// Example:
//     svc := NewService(RolePolicy{})
//     http.ListenAndServe(":8082", NewServer(svc))
func NewServer(svc *Service) http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            w.WriteHeader(http.StatusMethodNotAllowed)
            return
        }
        userID := r.Header.Get("X-User-ID")
        if userID == "" {
            http.Error(w, "missing X-User-ID", http.StatusBadRequest)
            return
        }
        m := svc.Login(userID)
        json.NewEncoder(w).Encode(m)
    })

    mux.HandleFunc("/tenants", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            w.WriteHeader(http.StatusMethodNotAllowed)
            return
        }
        userID := r.Header.Get("X-User-ID")
        if userID == "" {
            http.Error(w, "missing X-User-ID", http.StatusBadRequest)
            return
        }
        var payload struct{ Name string `json:"name"` }
        if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
            http.Error(w, "invalid payload", http.StatusBadRequest)
            return
        }
        t := svc.CreateTenant(payload.Name, userID)
        json.NewEncoder(w).Encode(t)
    })

    mux.HandleFunc("/tenants/", func(w http.ResponseWriter, r *http.Request) {
        // expect /tenants/{id}/invite
        if !strings.HasSuffix(r.URL.Path, "/invite") || r.Method != http.MethodPost {
            w.WriteHeader(http.StatusNotFound)
            return
        }
        parts := strings.Split(r.URL.Path, "/")
        if len(parts) != 4 {
            w.WriteHeader(http.StatusBadRequest)
            return
        }
        tenantID, err := uuid.Parse(parts[2])
        if err != nil {
            http.Error(w, "bad tenant id", http.StatusBadRequest)
            return
        }
        userID := r.Header.Get("X-User-ID")
        if userID == "" {
            http.Error(w, "missing X-User-ID", http.StatusBadRequest)
            return
        }
        var payload struct {
            UserID string `json:"user_id"`
            Role   Role   `json:"role"`
        }
        if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
            http.Error(w, "invalid payload", http.StatusBadRequest)
            return
        }
        m, err := svc.Invite(tenantID, userID, payload.UserID, payload.Role)
        if err != nil {
            http.Error(w, err.Error(), http.StatusForbidden)
            return
        }
        json.NewEncoder(w).Encode(m)
    })

    mux.HandleFunc("/memberships/", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPatch {
            w.WriteHeader(http.StatusMethodNotAllowed)
            return
        }
        parts := strings.Split(r.URL.Path, "/")
        if len(parts) != 3 {
            w.WriteHeader(http.StatusBadRequest)
            return
        }
        id, err := uuid.Parse(parts[2])
        if err != nil {
            http.Error(w, "bad membership id", http.StatusBadRequest)
            return
        }
        userID := r.Header.Get("X-User-ID")
        if userID == "" {
            http.Error(w, "missing X-User-ID", http.StatusBadRequest)
            return
        }
        var payload struct{ Role Role `json:"role"` }
        if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
            http.Error(w, "invalid payload", http.StatusBadRequest)
            return
        }
        m, err := svc.UpdateMembership(id, userID, payload.Role)
        if err != nil {
            if err.Error() == "membership not found" {
                http.Error(w, err.Error(), http.StatusNotFound)
            } else {
                http.Error(w, err.Error(), http.StatusForbidden)
            }
            return
        }
        json.NewEncoder(w).Encode(m)
    })

    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        json.NewEncoder(w).Encode(svc.Health())
    })

    return mux
}

