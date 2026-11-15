# Integrations

One folder per integration: `integrations/<name>/plugin.py` defining
`class Plugin(Integration)` (see `_template/`). The core discovers them
automatically and lists them at `/integrations` in the dashboard.

- Secrets: `/srv/moonshots/secrets/integrations/<name>.env` (KEY=VALUE, mode 600,
  gitignored). Available as `self.secrets`.
- Anything that spends money, uses or creates credentials, or takes an
  irreversible external action (publishing, emailing, payments, deleting)
  must be decorated with `@sensitive("financial"|"credential"|"external")`.
  The first call raises `ApprovalRequired` and creates a pending approval;
  after Don approves it in the dashboard, the next identical call runs once.
