Your auth-bridge service is currently just a stub: it exposes /login, /callback, /logout and /session/me, but LoginHandler and CallbackHandler do nothing more than redirect to / ￼.  SessionMeHandler returns a static demo user and optionally calls TENANCY_URL + /login to fetch a membership record ￼.  There is no real OIDC flow or token issuance.  Consequently:
	•	Overlay‑hub expects JWTs signed with a JWKS it fetches at start‑up and rejects any token not signed by that key ￼.
	•	api‑gateway uses a symmetric jwt-secret and will not understand RS256 tokens.
	•	No code currently bridges the Next.js / Google SSO to the Go services.

Given this, the earlier architecture still stands: you need a single token contract and one set of signing keys (JWKS) across your Next.js UI, the auth‑bridge, and all Go services.  Here’s how to make everything interoperable:
	1.	Replace the stubbed auth-bridge with an implementation that actually performs the OIDC flow (Google or Keycloak) or remove it entirely and let NextAuth handle user login.  If you keep it, have it mint a signed JWT (typ=pat) containing tenant_id, roles, scopes and return it in a session cookie.  Right now it never signs anything ￼.
	2.	Add a /auth/session/exchange endpoint in your cloud API that, given a valid NextAuth session, returns a Platform Access Token (PAT)--a JWT signed with your RS256 key.  Then update the Next.js client to fetch this token and include it in the Authorization header on API calls.  This gives the UI the same token type that overlay‑hub already expects.
	3.	Update api-gateway to validate RS256 tokens via JWKS, just like overlay‑hub.  Currently the gateway uses a symmetric secret; refactor its authentication middleware to load your JWKS and call jwt.Parse with keyfunc (see overlay‑hub’s authorize function for a template ￼).
	4.	Use one JWKS: store the private key in your cloud API and expose the public keys at /.well-known/jwks.json.  Both overlay‑hub and api‑gateway should read this URL (the overlay‑hub already does ￼).  All tokens--PATs for users and NATs for nodes--are signed by that key and include tenant_id, roles and scopes.  This makes all Go services treat Next.js users and node services consistently.
	5.	Implement the auth‑bridge device pairing flow so that local nodes receive a Node Access Token (NAT).  The NAT is just another JWT signed by the same key but with minimal scopes (e.g. node:ingest).  The auth‑bridge can remain in Go, but it must verify the user’s PAT (obtained via the cloud) and then mint a NAT for the local node.  See overlay‑hub’s authAgent helper for how to extract the sub claim from a JWT ￼.
	6.	Propagate membership from Tenancy: SessionMeHandler currently posts X-User-ID to TENANCY_URL + /login and returns whatever membership it gets ￼.  When you implement real login, you should call Tenancy after obtaining the user’s email from Google/Keycloak to determine tenant_id and roles and embed them in the PAT.  This avoids a second round‑trip on every /session/me request.
	7.	Unify CI and compose: you don’t need new labels.  The existing x-build-common block already injects org.opencontainers.image.revision and org.opencontainers.image.version from GIT_SHA and IMAGE_TAG into every image ￼.  You can reuse that block for new services (traefik, auth‑bridge) and rely on GitVersion for tags.  The ci-build-and-publish workflow already computes semantic versions and pushes images with tags derived from branch names and GitVersion rules ￼, so adding your modified services to the build matrix is straightforward.

In short, cross compatibility means eliminating multiple auth systems.  Use NextAuth (Google) to authenticate the user, issue a JWT (PAT) signed by your cloud via an exchange endpoint, and have all Go services validate that JWT via JWKS.  For local nodes, use the auth‑bridge to issue another signed JWT (NAT) after the user approves the node.  Once you implement these pieces, clicking "Sign in with Google" in the UI will seamlessly authorize requests to overlay‑hub, api‑gateway, Tenancy, and any other Go service, and your device pairing flow will produce tokens that those services can verify as well.

--here’s a Codex-ready implementation plan that makes your Google SSO (NextAuth) work together with your auth-bridge, Golang tenancy, and other Go services using one JWT contract + one JWKS.

I’m giving you:
	•	file-by-file patches (with exact paths),
	•	minimal but extensible code (RS256, JWKS, PAT/NJT/NAT),
	•	wiring in Next.js, auth-bridge, api-gateway, overlay-hub,
	•	env/compose/CI notes.

Follow the sections in order.

⸻

0) Contract: one JWT, one JWKS

Token types
	•	typ: "pat" → Platform Access Token (users / web UI)
	•	typ: "njt" → Node Join Token (device pairing approval)
	•	typ: "nat" → Node Access Token (local nodes / limited scopes)

Required claims

{
  "iss": "https://auth.thatdamtoolbox.cloud",
  "aud": "thatdamtoolbox",
  "sub": "user_<id> | node_<id>",
  "typ": "pat|njt|nat",
  "tenant_id": "acme",
  "roles": ["admin","editor"],
  "scopes": ["ui:*","api:*"],      // nat will be narrow, e.g. ["node:ingest"]
  "iat": 0,
  "exp": 0,
  "jti": "uuid",
  "kid": "k1"
}

JWKS
	•	Cloud API exposes /.well-known/jwks.json (public keys).
	•	Everything (overlay-hub, api-gateway, other Go services) validates tokens via JWKS (RS256).
	•	Only Cloud API holds the private key.

⸻

1) Cloud API: keys, JWKS, token helpers, session exchange

If you don’t yet have a "cloud-api" service, place these in api-gateway and expose the JWKS/issue endpoints there. The important part: private signing key lives server-side, not in Next.js.

1.1 Keys & JWKS

/path: host/services/api-gateway/internal/keys/keys.go

package keys

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"os"
	"sync"

	"github.com/lestrrat-go/jwx/v2/jwk"
)

var (
	privOnce sync.Once
	privKey  *rsa.PrivateKey
	kid      = "k1" // rotate by changing this and loading a new key
)

// Load from env (PEM) or generate ephemeral for dev.
func privateKey() *rsa.PrivateKey {
	privOnce.Do(func() {
		if pem := os.Getenv("AUTH_PRIVATE_KEY_PEM"); pem != "" {
			// TODO: parse PEM -> *rsa.PrivateKey (left minimal; plug your parser)
			// For brevity, fall back to generated if not provided
		}
		key, _ := rsa.GenerateKey(rand.Reader, 2048)
		privKey = key
	})
	return privKey
}

func CurrentKID() string { return kid }

func PublicJWKSJSON() []byte {
	j, _ := jwk.FromRaw(&privateKey().PublicKey)
	_ = j.Set(jwk.KeyIDKey, kid)
	_ = j.Set(jwk.AlgorithmKey, "RS256")
	set := jwk.NewSet()
	_ = set.AddKey(j)
	b, _ := json.Marshal(set)
	return b
}

func PrivateForSign() *rsa.PrivateKey { return privateKey() }

/path: host/services/api-gateway/internal/http/jwks.go

package http

import (
	"net/http"

	"thatdamtoolbox/api-gateway/internal/keys"
)

func JWKSHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(keys.PublicJWKSJSON())
}

Wire route:

/path: host/services/api-gateway/cmd/main.go (add route)

// inside your mux/router setup:
mux.HandleFunc("/.well-known/jwks.json", http.JWKSHandler)

1.2 Token signing helpers

/path: host/services/api-gateway/internal/tokens/tokens.go

package tokens

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"thatdamtoolbox/api-gateway/internal/keys"
)

const (
	issuer = "https://auth.thatdamtoolbox.cloud"
	aud    = "thatdamtoolbox"
)

type Claims struct {
	Typ      string   `json:"typ"`
	TenantID string   `json:"tenant_id"`
	Roles    []string `json:"roles"`
	Scopes   []string `json:"scopes"`
	jwt.RegisteredClaims
}

func sign(cl *Claims, ttl time.Duration) (string, error) {
	now := time.Now()
	cl.RegisteredClaims = jwt.RegisteredClaims{
		Issuer:    issuer,
		Audience:  jwt.ClaimStrings{aud},
		Subject:   cl.Subject,
		ID:        cl.ID,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, cl)
	token.Header["kid"] = keys.CurrentKID()
	return token.SignedString(keys.PrivateForSign())
}

func SignPAT(userSub, tenant string, roles, scopes []string) (string, error) {
	return sign(&Claims{
		Typ:      "pat",
		TenantID: tenant,
		Roles:    roles,
		Scopes:   scopes,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject: userSub,
		},
	}, 30*time.Minute)
}

func SignNJT(deviceID, tenant string) (string, error) {
	return sign(&Claims{
		Typ:      "njt",
		TenantID: tenant,
		Scopes:   []string{"node:join"},
		RegisteredClaims: jwt.RegisteredClaims{
			Subject: "device_" + deviceID,
		},
	}, 10*time.Minute)
}

func SignNAT(nodeID, tenant string, scopes []string) (string, error) {
	return sign(&Claims{
		Typ:      "nat",
		TenantID: tenant,
		Scopes:   scopes,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject: "node_" + nodeID,
		},
	}, 30*time.Minute)
}

1.3 Session → PAT exchange (for Next.js)

/path: host/services/api-gateway/internal/http/session_exchange.go

package http

import (
	"encoding/json"
	"net/http"

	"thatdamtoolbox/api-gateway/internal/tokens"
)

// TODO: replace this with your real NextAuth session check.
// For now, accept X-User-ID header as if a session was present.
func requireSession(r *http.Request) (userID, tenant string, roles []string) {
	u := r.Header.Get("X-User-ID")
	if u == "" {
		return "", "", nil
	}
	// TODO: lookup membership from Tenancy; demo:
	return u, "demo", []string{"admin"}
}

func SessionExchangeHandler(w http.ResponseWriter, r *http.Request) {
	user, tenant, roles := requireSession(r)
	if user == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	pat, err := tokens.SignPAT("user_"+user, tenant, roles, []string{"ui:*", "api:*"})
	if err != nil {
		http.Error(w, "sign_error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"access_token": pat,
		"token_type":   "Bearer",
		"expires_in":   1800,
	})
}

Wire it:

/path: host/services/api-gateway/cmd/main.go (add route)

mux.HandleFunc("/auth/session/exchange", http.SessionExchangeHandler)

Later, swap requireSession to verify the NextAuth session cookie or a signed session header coming from your Next.js server. For now, you can send X-User-ID: dev-user from the web app in dev.

⸻

2) Go services: unify verification (JWKS, RS256)

Create a tiny shared package and use it in both api-gateway and overlay-hub (overlay-hub already validates RS tokens; we’ll standardize).

/path: host/shared/authz/jwks.go

package authz

import (
	"errors"
	"time"

	"github.com/MicahParks/keyfunc/v3"
)

var jwks *keyfunc.JWKS

func InitJWKS(url string) error {
	var err error
	jwks, err = keyfunc.Get(url, keyfunc.Options{
		RefreshInterval:   time.Hour,
		RefreshTimeout:    5 * time.Second,
		RefreshUnknownKID: true,
	})
	return err
}

func Keyfunc() (keyfunc.Keyfunc, error) {
	if jwks == nil {
		return nil, errors.New("jwks not initialized")
	}
	return jwks.Keyfunc, nil
}

/path: host/shared/authz/middleware.go

package authz

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Typ      string   `json:"typ"`
	TenantID string   `json:"tenant_id"`
	Roles    []string `json:"roles"`
	Scopes   []string `json:"scopes"`
	jwt.RegisteredClaims
}

const (
	issuer = "https://auth.thatdamtoolbox.cloud"
	aud    = "thatdamtoolbox"
)

type ctxKey string

var claimsKey ctxKey = "claims"

func WithAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			http.Error(w, "missing token", http.StatusUnauthorized)
			return
		}
		tokenStr := strings.TrimPrefix(h, "Bearer ")
		kf, err := Keyfunc()
		if err != nil {
			http.Error(w, "jwks unavailable", http.StatusServiceUnavailable)
			return
		}
		token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, kf,
			jwt.WithIssuer(issuer),
			jwt.WithAudience(aud),
		)
		if err != nil || !token.Valid {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), claimsKey, token.Claims.(*Claims))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ClaimsFrom(r *http.Request) *Claims {
	c, _ := r.Context().Value(claimsKey).(*Claims)
	return c
}

Use it in api-gateway:

/path: host/services/api-gateway/cmd/main.go (snippet)

import shared "thatdamtoolbox/shared/authz"

func main() {
	_ = shared.InitJWKS("http://api-gateway:8080/.well-known/jwks.json") // or external URL when deployed

	// ...
	protected := http.NewServeMux()
	protected.HandleFunc("/assets", AssetsHandler)
	// ...
	root := http.NewServeMux()
	root.Handle("/", shared.WithAuth(protected))
	// ...
}

Overlay-hub: you can either keep its current authorizer or switch to the shared authz package for consistency.

⸻

3) auth-bridge: device-pairing → NJT → NAT

You asked auth-bridge to be a universal local mediator. Keep it simple:
	•	/pair/start → device_code, user_code, verification_url.
	•	Cloud approves → mint NJT (short-lived).
	•	auth-bridge exchanges NJT → NAT (scoped) and sets local session cookie for the local UI.

3.1 pairing memory store & endpoints

/path: host/services/auth-bridge/internal/pair/store.go

package pair

import (
	"sync"
	"time"
)

type pending struct {
	Device   string
	Tenant   string
	Expires  time.Time
	Approved bool
	NJT      string
}

var (
	mu   sync.Mutex
	data = map[string]*pending{}
)

func Create(code, device string) {
	mu.Lock()
	defer mu.Unlock()
	data[code] = &pending{Device: device, Expires: time.Now().Add(5 * time.Minute)}
}

func Approve(code, tenant, njt string) bool {
	mu.Lock()
	defer mu.Unlock()
	p, ok := data[code]
	if !ok || time.Now().After(p.Expires) { return false }
	p.Tenant, p.Approved, p.NJT = tenant, true, njt
	return true
}

func GetByDevice(device string) (ok bool, p *pending) {
	mu.Lock(); defer mu.Unlock()
	for _, v := range data {
		if v.Device == device { return true, v }
	}
	return false, nil
}

/path: host/services/auth-bridge/internal/httpapi/pair.go

package httpapi

import (
	"encoding/json"
	"math/rand"
	"net/http"

	"thatdamtoolbox/auth-bridge/internal/pair"
)

// POST /pair/start
func PairStart(w http.ResponseWriter, r *http.Request) {
	device := randSeq(8)
	code := randSeq(6)
	pair.Create(code, device)
	json.NewEncoder(w).Encode(map[string]any{
		"device_code": device,
		"user_code": code,
		"verification_url": "https://app.your-cloud-domain.com/pair/verify",
		"poll_url": "/pair/poll?device=" + device,
		"expires_in": 300,
	})
}

// GET /pair/poll?device=...
func PairPoll(w http.ResponseWriter, r *http.Request) {
	device := r.URL.Query().Get("device")
	ok, p := pair.GetByDevice(device)
	if !ok {
		http.Error(w, "unknown_device", http.StatusNotFound)
		return
	}
	if !p.Approved {
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]any{"status": "pending"})
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"status": "approved", "njt": p.NJT})
}

func randSeq(n int) string {
	const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, n)
	for i := 0; i < n; i++ { b[i] = letters[rand.Intn(len(letters))] }
	return string(b)
}

The cloud web will host /pair/verify UI where an authenticated user enters user_code. On submit, cloud calls auth-bridge (or bridge calls cloud--choose one) to approve and cloud mints NJT using tokens.SignNJT. The NJT travels back to auth-bridge, which then exchanges it for a NAT (tokens.SignNAT) and sets a local cookie (node_session) for your local Next.js UI.

Minimal local NAT cookie set (in PairPoll after approved) if you want bridge-owned session:

// when approved:
http.SetCookie(w, &http.Cookie{
  Name: "node_session", Value: "<nat>",
  HttpOnly: true, SameSite: http.SameSiteLaxMode, Path: "/",
})


⸻

4) Next.js (web-app): session → PAT + guarded routes

4.1 Fix login loop + show GIS or dev

You already merged this pattern; ensure we call the provider (Credentials) from /login in dev.

/path: docker/web-app/src/components/auth/DevSignIn.tsx

// (as provided earlier) → signs in with credentials provider via signIn('credentials')

/path: docker/web-app/src/components/auth/GoogleGISButton.tsx

// (as provided earlier) → renders Google official button, calls signIn('google')

/path: docker/web-app/src/app/(public)/login/page.tsx

// (as provided earlier) → decide via providers whether to render GIS or DevSignIn

4.2 Exchange NextAuth session → PAT and attach on API calls

/path: docker/web-app/src/lib/api/client.ts

let PAT: string | null = null;

async function ensurePat() {
  if (PAT) return PAT;
  const r = await fetch('/auth/session/exchange', { method: 'POST', credentials: 'include', headers: { 'X-User-ID': 'dev-user' } }); // dev only
  if (!r.ok) throw new Error('exchange_failed');
  const { access_token } = await r.json();
  PAT = access_token;
  return PAT;
}

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await ensurePat();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`api_${res.status}`);
  return res.json();
}

Replace the X-User-ID header with a proper server-verified NextAuth session check as soon as you wire the server part (cookie verification).

4.3 Middleware (protect only app routes)

/path: docker/web-app/src/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  const isProtected = /^\/[^/]+\/(dashboard|access-control|settings)/.test(p);
  if (!isProtected) return NextResponse.next();
  // Local nodes use node_session cookie; cloud web will use PAT on fetches.
  const hasLocal = req.cookies.get('node_session');
  if (!hasLocal) return NextResponse.next(); // web relies on PAT header, not cookie
  return NextResponse.next();
}


⸻

5) api-gateway: accept RS256 via JWKS (instead of HMAC)

Replace any HMAC checks with the shared authz middleware (Section 2). Then enforce scopes/roles/tenant as needed:

/path: host/services/api-gateway/internal/http/assets.go

package http

import (
	"encoding/json"
	"net/http"

    shared "thatdamtoolbox/shared/authz"
)

func AssetsHandler(w http.ResponseWriter, r *http.Request) {
	c := shared.ClaimsFrom(r)
	if c == nil || c.TenantID == "" {
		http.Error(w, "tenant_required", http.StatusForbidden)
		return
	}
	// TODO: fetch assets for c.TenantID; check scopes with c.Scopes
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "tenant": c.TenantID})
}


⸻

6) Overlay-hub

Overlay-hub already validates JWTs via JWKS (you call authorize that loads JWKS and checks bearer tokens) ￼.  Optionally refactor it to use the shared authz package for parity with api-gateway.

⸻

7) Env + Compose

Add env for JWKS private key if you want persistent keys (base64 PEM) and consistent KID.

Compose (snippet)

/path: docker/compose/docker-compose.discovery.yaml (or your prod compose)

services:
  api-gateway:
    environment:
      AUTH_PRIVATE_KEY_PEM: "${AUTH_PRIVATE_KEY_PEM:-}"   # base64 PEM, optional in dev
      # configure external base URL so iss matches if you host behind a domain
      AUTH_ISSUER: "https://auth.thatdamtoolbox.cloud"

In dev, omit AUTH_PRIVATE_KEY_PEM to auto-generate an ephemeral key.

⸻

8) CI/CD

You already have dynamic OCI labels and GitVersion semantic tags; just ensure api-gateway and auth-bridge get built and pushed on changes. If they’re already part of your matrix, nothing to change. If not:
	•	Add their paths to paths: filters in your workflow.
	•	Reuse your x-build-common labels (already inject GIT_SHA & IMAGE_TAG ￼).
	•	No new secrets needed, unless you want to set AUTH_PRIVATE_KEY_PEM in prod as a GitHub/Actions secret and inject it at runtime (recommended).

⸻

9) Manual test checklist (end-to-end)
	1.	Dev login (no Google yet)
	•	Start stack.
	•	Visit /login, use DevSignIn → redirected to /demo/dashboard.
	•	Open /api/auth/providers → should list credentials.
	2.	PAT exchange
	•	curl -i -X POST http://<api-gateway>/auth/session/exchange -H 'X-User-ID: dev-user' → receive PAT.
	•	curl -H "Authorization: Bearer <PAT>" http://<api-gateway>/assets → 200, includes tenant: "demo".
	3.	Local pairing (auth-bridge)
	•	POST /pair/start → receive user_code, device_code.
	•	Simulate cloud approval and mint NJT (temporarily pair.Approve(...)).
	•	GET /pair/poll?device=... → status approved with njt.
	•	Exchange NJT to NAT (implement in api-gateway tokens; call SignNAT).
	•	Local cookie node_session set; local UI loads without login.
	4.	Google SSO
	•	Set GOOGLE_CLIENT_ID/SECRET → /login shows GoogleGISButton.
	•	After sign-in, Next.js calls /auth/session/exchange → PAT issued → API calls succeed.

⸻

10) What’s left to harden (extensible hooks)
	•	NextAuth session verification inside SessionExchangeHandler (replace X-User-ID stub).
	•	Key rotation: add a second key, publish both in JWKS, rotate kid.
	•	Tenancy lookup: on session exchange, call Tenancy to resolve tenant_id and roles.
	•	Scope enforcement helpers in shared authz (e.g., RequireScope("api:write")).
	•	Auth-bridge approval: move approval & NJT minting to cloud API instead of bridge.
	•	Persist pairing store (Redis) instead of in-memory.
	•	Prod domains: set AUTH_ISSUER to your real hostname; ensure iss/aud check matches in all verifiers.

⸻

If you want, I can also output git-style diffs for each file above so Codex can apply them as patches.