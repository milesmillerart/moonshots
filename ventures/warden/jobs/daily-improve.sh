#!/usr/bin/env bash
# daily-improve: rebuild + redeploy WARDEN at /warden/.
# Whatever landed in game/ since yesterday (art passes, combat feel, new gear/Cores/perks,
# story beats) goes live here. Local only: no external services, no paid APIs.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/build.py
/srv/moonshots/bin/moonshots deploy warden
build=$(python3 -c 'import json;print(json.load(open("public/build.json"))["build"])')
updates=$(python3 -c 'import json;print(len(json.load(open("game/data/changelog.json"))))')
if [[ -n "${MOONSHOTS_API:-}" && -n "${MOONSHOTS_AGENT_TOKEN:-}" ]]; then
  curl -fsS -X POST "$MOONSHOTS_API/metrics" -H "Authorization: Bearer $MOONSHOTS_AGENT_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"venture\":\"${MOONSHOTS_VENTURE:-warden}\",\"key\":\"warden_updates\",\"value\":$updates}" >/dev/null || true
fi
echo "daily-improve ok $(date -u +%FT%TZ): build=$build changelog_entries=$updates"
