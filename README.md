# Backend

Run `npm run knip` to report unused files, exports, and dependency declarations.
Knip is pinned in the development dependencies and installed with `npm ci`.
The configuration also includes the `workers/gmail-relay` package.

Scraper scripts, catalogs, providers, and fallback modules are explicit entry
points because operational tooling discovers them by path or reads their source.
Named/default export aliases on scraper entry modules are intentional. Archived
reports are excluded from findings; unresolved imports and other remaining
findings stay visible for review.
