# Deploy Cheat Sheet

## Dev (mutable channel)
```bash
cp ops/ci/vars.env.example ops/ci/vars.env   # optional for local release
make login/ghcr
make release/edge ENV_FILE=ops/ci/vars.env

cd docker/compose/dev
docker compose --env-file .env.dev up -d

# Add Traefik + Tailscale sidecars
docker compose -f docker-compose.yaml -f docker/compose/docker-compose.traefik.yaml up -d traefik tailscale
```

## Prod (digest pinned)
- Push a tag: `git tag v1.4.0 && git push origin v1.4.0`
- CI builds multi-arch, publishes `thatdam-run:1.4.0`, updates channel, and writes the digest into the release body.
- On the host:

```bash
# Option A: use explicit digest printed by CI
DIGEST="ghcr.io/cdaprod/thatdam-run:1.4.0@sha256:..." \
  ./ops/deploy/prod/pull-run.sh

# Option B: fetch digest from the tag body (requires GitHub CLI)
TAG=v1.4.0 ./ops/deploy/prod/pull-run.sh
```

## Edge
Same as prod, but your config may point to local backends:
- Mount config: `-v $(pwd)/ops/deploy/edge/config/edge.yaml:/etc/thatdam/edge.yaml:ro`
- Add envs for Tailscale, etc.

## Vercel branch
Push or open a pull request against the `vercel` branch to build and deploy the web app via Vercel.
