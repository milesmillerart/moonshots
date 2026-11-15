#!/usr/bin/env bash
# ship-daily: the daily release train for Daycade (Infinite Arcade venture).
#
# What it does today (no external services, no paid APIs, nothing to approve):
#   1. Rebuilds the site for today's date. Games in src/games.json whose `released`
#      date is <= today go live; later-dated games stay queued. The "New today" slot,
#      card badges and sitemap lastmod all refresh.
#   2. Deploys public/ to /arcade via the core CLI (local file copy).
#   3. Reports live/queued counts to the dashboard as metrics.
#
# STUB for the future "ship a new game" automation: a generation step would add a new
# src/games/<slug>/ plus a games.json entry dated for release, run tools/smoke_test.py
# against a local preview, and only then let this job release it. Any step that would
# call a paid model/API must go through the approvals queue first (approval: financial).
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/build.py
/srv/moonshots/bin/moonshots deploy infinite-arcade
live=$(python3 -c 'import json;print(len(json.load(open("public/release.json"))["live"]))')
queued=$(python3 -c 'import json;print(len(json.load(open("public/release.json"))["queued"]))')
if [[ -n "${MOONSHOTS_API:-}" && -n "${MOONSHOTS_AGENT_TOKEN:-}" ]]; then
  for kv in "games_live:$live" "games_queued:$queued"; do
    curl -fsS -X POST "$MOONSHOTS_API/metrics" -H "Authorization: Bearer $MOONSHOTS_AGENT_TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"venture\":\"${MOONSHOTS_VENTURE:-infinite-arcade}\",\"key\":\"${kv%%:*}\",\"value\":${kv##*:}}" >/dev/null || true
  done
fi
echo "ship-daily ok $(date -u +%FT%TZ): live=$live queued=$queued"
if [[ "$queued" == "0" ]]; then echo "WARNING: release queue is empty; add the next game to src/games.json"; fi
