# Design Tokens Migration

Steps to move `@cdaprod/design-tokens` to its own repository.

1. **Create new repository** with the current `packages/design-tokens` folder.
2. **Publish** the package from that repo to Verdaccio or another registry.
3. **Remove** `packages/design-tokens` from this monorepo and update workspace references.
4. **Update consumers** (`docker/web-app`, `docker/web-site`, services) to depend on the published version.
5. **Tag releases** using semantic versioning to control upgrades.

Example:
```bash
# new repo
git clone git@github.com:your-org/design-tokens.git
cd design-tokens && npm publish --registry <registry>
```

