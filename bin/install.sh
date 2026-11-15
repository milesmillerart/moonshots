#!/usr/bin/env bash
# Idempotent setup for the core (no sudo needed). Run as the moonshots user.
set -euo pipefail
ROOT="${MOONSHOTS_ROOT:-/srv/moonshots}"
cd "$ROOT"
mkdir -p data logs/ventures secrets/integrations secrets/ventures
chmod 700 secrets secrets/integrations secrets/ventures
[ -d core/.venv ] || python3 -m venv core/.venv
core/.venv/bin/pip install -q --upgrade pip
core/.venv/bin/pip install -q -r core/requirements.txt

umask 077
if [ ! -f secrets/dashboard.env ]; then
  printf 'DASHBOARD_USER=don\nDASHBOARD_PASSWORD=%s\n' "$(python3 -c 'import secrets;print(secrets.token_urlsafe(24))')" > secrets/dashboard.env
  echo "created secrets/dashboard.env"
fi
if [ ! -f secrets/agent.env ]; then
  printf 'MOONSHOTS_AGENT_TOKEN=%s\n' "$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')" > secrets/agent.env
  echo "created secrets/agent.env"
fi
chmod 600 secrets/*.env

mkdir -p ~/.config/systemd/user
ln -sf "$ROOT/deploy/systemd/moonshots-core.service" ~/.config/systemd/user/moonshots-core.service
systemctl --user daemon-reload
systemctl --user enable --now moonshots-core.service
systemctl --user restart moonshots-core.service
echo "core installed; health: curl -s http://127.0.0.1:8100/healthz"
