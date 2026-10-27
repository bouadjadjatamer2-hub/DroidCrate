# Data files

Everything under this directory is plain data, so contributors can extend the app
without touching TypeScript.

- `devices.json` — USB vendor/product identifiers and connection modes.
- `tools.json` — the tool library, official links, drivers, and common issues.
- `checklists.json` — ordered pre-flight checks, required flags, and explanations.
- `lessons.json` — lesson metadata, levels, and quiz questions.
- `lessons/*.md` — lesson bodies in Markdown.
- `platform-tools.json` — the official download URL and pinned SHA-256 digest.
- `content-manifest.json` — version and hashes for content updates.

Rules:

1. Official sources only. No mirrors, cracked builds, or firmware files.
2. Keep descriptions factual and concise; do not copy vendor documentation.
3. Every content update must keep the existing JSON shape or bump the schema.
