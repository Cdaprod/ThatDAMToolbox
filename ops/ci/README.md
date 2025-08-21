# Dynamic CI Vars (quick use)

## Dev (local)
```bash
cp ops/ci/vars.env.example ops/ci/vars.env
# tweak CHANNEL=dev and VERSION=0.0.0-dev if you want

make login/ghcr
make release/edge ENV_FILE=ops/ci/vars.env
```

## Prod (tagged release)
```bash
git tag v1.4.0 && git push origin v1.4.0
# CI sets CHANNEL=prod, VERSION=1.4.0, builds multi-arch, tags channel, emits digest, and creates a GitHub Release.
```

## Staging (optional)
```bash
push to 'staging' branch; CI sets CHANNEL=staging and VERSION=<date>-<sha>.
```
