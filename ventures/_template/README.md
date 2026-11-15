# __NAME__

Venture workspace. Layout:

- `manifest.yaml`: status, jobs, deploy target (read by the core)
- `jobs/`: scripts run by the scheduler
- `app/`: service code + `Containerfile` (for `deploy.type: container`)
- `public/`: static build output (for `deploy.type: static`)
- `research/`: market notes, decisions

Secrets go in `/srv/moonshots/secrets/ventures/<slug>.env` (never here).
Deploy with `bin/moonshots deploy <slug>`.
