#!/usr/bin/env bash
# daily-improve: rebuild + redeploy Ebbmarrow (the RPG at /arcade/) and the Extras arcade.
#
# The daily cadence is IMPROVEMENTS, not date-locked chapters. Whatever landed in the repo
# since yesterday (art passes, feel tweaks, balance, new story beats, experiments; see
# docs/roadmap.md) goes live here. Nothing is gated by date.
#
# Local only: no external services, no paid APIs, nothing to approve. If a future step ever
# needs a paid model/API it must go through the approvals queue first (approval: financial).
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/build.py            # Extras arcade (5 original games) -> public/extras + game pages
python3 tools/build_rpg.py        # validate data + bundle Ebbmarrow -> public/index.html, game/, data/
/srv/moonshots/bin/moonshots deploy infinite-arcade
build=$(python3 -c 'import json;print(json.load(open("public/data/manifest.json"))["build"])')
updates=$(python3 -c 'import json;print(len(json.load(open("public/data/changelog.json"))))')
if [[ -n "${MOONSHOTS_API:-}" && -n "${MOONSHOTS_AGENT_TOKEN:-}" ]]; then
  curl -fsS -X POST "$MOONSHOTS_API/metrics" -H "Authorization: Bearer $MOONSHOTS_AGENT_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"venture\":\"${MOONSHOTS_VENTURE:-infinite-arcade}\",\"key\":\"rpg_updates\",\"value\":$updates}" >/dev/null || true
fi
echo "daily-improve ok $(date -u +%FT%TZ): build=$build changelog_entries=$updates"
