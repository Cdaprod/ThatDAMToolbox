# HOWTO: Daily Ops

## Cut a dev build
```bash
make release/edge ENV_FILE=ops/ci/vars.env
```

## Promote to prod
```bash
git tag v1.4.0 && git push origin v1.4.0
# Wait for CI → it will print the digest in logs and attach it to the Release.
```

## Roll prod with pinned digest
```bash
# Paste digest explicitly OR fetch from the tag
DIGEST="ghcr.io/cdaprod/thatdam-run:1.4.0@sha256:..." ./ops/deploy/prod/pull-run.sh
# or
TAG=v1.4.0 ./ops/deploy/prod/pull-run.sh
```

## Roll back
Use the previous tag’s digest with the same script:
```bash
TAG=v1.3.9 ./ops/deploy/prod/pull-run.sh
```

---

### Sanity checklist (do once)

- In repo **Secrets**: ensure `GITHUB_TOKEN` (automatic), or set `GHCR_TOKEN`/`GHCR_USER` if you prefer.
- On prod host(s): `gh` CLI logged in (only needed if you want the script to auto-fetch digest by tag).
- Confirm your **self-hosted runner** labels cover `runs-on: [self-hosted, repo=thatdam, ephemeral]`.

---

### What you now have

- **Dev**: `docker compose` pulls `:dev` and runs with local overrides.
- **Edge**: single executable/container using the same contract; optional local OSS, graceful fallback.
- **Prod**: a one-liner that **pulls a digest** from the tag release and runs it, pinned.
