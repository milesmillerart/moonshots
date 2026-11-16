#!/usr/bin/env bash
# Example job: reports a metric to the core. Jobs get MOONSHOTS_API,
# MOONSHOTS_VENTURE and MOONSHOTS_AGENT_TOKEN in their environment.
set -euo pipefail
curl -fsS -X POST "$MOONSHOTS_API/metrics" \
  -H "Authorization: Bearer $MOONSHOTS_AGENT_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"venture\":\"$MOONSHOTS_VENTURE\",\"key\":\"heartbeat\",\"value\":1}" >/dev/null
echo "heartbeat ok $(date -u +%FT%TZ)"
