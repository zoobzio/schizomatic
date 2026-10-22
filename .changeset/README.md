# Changesets

This folder holds [changesets](https://github.com/changesets/changesets): one
Markdown file per change, declaring the semver bump and the release note.

Add one with `pnpm changeset` and commit it alongside your PR. The release
workflow applies pending changesets on demand and publishes.

Versioning is **fixed**. `schizomatic` and every `@schizomatic/*` package share
one version and release together, so a changeset for any of them bumps them
all.
