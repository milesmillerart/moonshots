# Moonshots

An autonomous venture-building system: one small core service plus independent
venture workspaces, built to fit a 1 vCPU / 2 GB droplet.

## Layout

```
/srv/moonshots
├── core/                 Python core (FastAPI + SQLite), runs in core/.venv
│   └── moonshots/        app.py (dashboard+API), scheduler.py, db.py, ventures.py,
│                         integrations.py, logs.py, cli.py
├── ventures/
│   ├── _template/        copied by bin/new-venture
│   └── <slug>/           one workspace per venture: manifest.yaml, jobs/, app/, public/, research/
├── integrations/         plugin folder: <name>/plugin.py -> class Plugin(Integration)
├── deploy/
│   ├── systemd/          moonshots-core.service (systemd --user)
│   └── apache/           reverse-proxy snippet for Don to install as root
├── bin/                  moonshots (CLI), new-venture, install.sh
├── data/                 SQLite DB + venture data volumes        (gitignored)
├── logs/                 JSON-lines logs, rotated 5 MB x 5        (gitignored)
└── secrets/              mode 700, KEY=VALUE .env files            (gitignored)
```

## Core service

One process (`moonshots-core.service`, systemd --user, linger on, so it survives
reboots) listening on **127.0.0.1:8100** only. About 50 MB RSS, capped at 400 MB.

1. **Dashboard** (server-rendered HTML): ventures and status, jobs, recent runs,
   metrics, recent logs, system load/memory/disk, and the **pending-approvals queue**
   with Approve/Reject buttons.
2. **Scheduler**: an in-process cron runner. Each venture's `manifest.yaml` lists jobs
   (cron schedule, command, timeout). Manifests are rescanned every 60 s. Scheduled
   jobs only run when the venture status is `building` or `live`. At most 2 jobs run
   at once. Every run is recorded in SQLite and logged.
3. **Approvals**: the guardrail. Anything involving money, credentials, or an
   irreversible external action must go through it:
   - a job with `approval: financial|credential|external|other` in its manifest is
     blocked and creates a pending request until Don approves it. Each approval is
     single-use.
   - integration methods decorated with `@sensitive(kind)` behave the same way.
   - jobs and agents can call `POST /api/approvals` for ad-hoc requests.

### Auth

| Who | How | Can |
|---|---|---|
| Don (dashboard) | HTTP Basic, `secrets/dashboard.env` | everything, including approving |
| Jobs/agents | `Authorization: Bearer` from `secrets/agent.env` | read status, post metrics and logs, request approvals, trigger jobs. **Cannot approve.** |
| Anyone | `GET /healthz` | liveness only |

Dashboard forms are CSRF-protected. Note that a process running as the `moonshots`
user can read the secrets directory. The split keeps scripted jobs from approving
their own requests; it is not protection against a compromised account.

### API (prefix `/api`)

`GET /status` · `POST /approvals` · `GET /approvals/{id}` · `POST /approvals/{id}/consume`
· `POST /metrics` · `POST /logs` · `POST /jobs/{venture}/{job}/run` · `POST /sync`

Jobs receive `MOONSHOTS_API`, `MOONSHOTS_VENTURE`, `MOONSHOTS_JOB`,
`MOONSHOTS_AGENT_TOKEN`, plus `secrets/ventures/<slug>.env`, in their environment.

## Ventures

```
bin/new-venture my-venture --name "My Venture" --description "pitch" --status idea
bin/moonshots list | sync | run <venture>/<job> | approvals [--all] | metric <v> <k> <n> | deploy <venture>
```

Deploy targets (in `manifest.yaml` under `deploy:`):
- `none`
- `static`: copies `public/` to `/var/www/moon.sparelimbstudios.com/public_html/<path>`
- `container`: `podman build` of `app/`, plus a Quadlet unit
  (`~/.config/containers/systemd/moonshots-<slug>.container`) publishing on
  `127.0.0.1:<port>` (8101-8999) with memory and CPU limits. Apache proxies get added
  by root when a venture is ready to go public.

The core runs in a venv rather than a container because it orchestrates host-level
things (podman, systemd --user, the web root). Venture apps and their dependencies
run in rootless podman containers.

## Integrations

See `integrations/README.md`. Plugins load automatically. Secrets live in
`secrets/integrations/<name>.env`, and sensitive methods are approval-gated.

## Operations

- Install/upgrade: `bin/install.sh` (idempotent; creates secrets on first run)
- Service: `systemctl --user status|restart moonshots-core`; `journalctl --user -u moonshots-core`
- Health: `curl -s http://127.0.0.1:8100/healthz`
- Logs: `logs/core.jsonl`, `logs/ventures/<slug>.jsonl`

## Guardrails

Everything must be legal. Nothing gets spent without Don's explicit approval, and
financial transactions, sensitive credentials, and irreversible external actions all
go through the approvals queue. Ventures are independent brands and never carry
Don's personal name.
