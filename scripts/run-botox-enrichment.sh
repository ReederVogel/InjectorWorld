#!/usr/bin/env bash
# Drives scripts/import-botox-enrichment.ts through multiple short-lived
# process invocations (fresh DB connection each time) to avoid DigitalOcean's
# managed Postgres dropping long-lived connections mid-import.
#
# Usage:
#   ./scripts/run-botox-enrichment.sh match --csv "C:/Users/risha/Downloads/botox.csv" [--limit N]
#   ./scripts/run-botox-enrichment.sh updates [--apply] [--chunk 300]
#   ./scripts/run-botox-enrichment.sh newclinics [--apply] [--chunk 300]
set -uo pipefail

MAX_RETRIES=5

PHASE="${1:-}"
shift || true

CACHE_DIR=".tmp/botox-cache"
SUMMARY_FILE="$CACHE_DIR/summary.json"

if [ "$PHASE" = "match" ]; then
  npx tsx scripts/import-botox-enrichment.ts --phase match "$@"
  exit 0
fi

if [ "$PHASE" != "updates" ] && [ "$PHASE" != "newclinics" ]; then
  echo "Usage: $0 match --csv <path> [--limit N]"
  echo "       $0 updates [--apply] [--chunk 300]"
  echo "       $0 newclinics [--apply] [--chunk 300]"
  exit 1
fi

APPLY=""
CHUNK=300
START=0
ARGS=("$@")
for i in "${!ARGS[@]}"; do
  if [ "${ARGS[$i]}" = "--apply" ]; then APPLY="--apply"; fi
  if [ "${ARGS[$i]}" = "--chunk" ]; then CHUNK="${ARGS[$((i+1))]}"; fi
  if [ "${ARGS[$i]}" = "--start" ]; then START="${ARGS[$((i+1))]}"; fi
done

if [ "$PHASE" = "updates" ]; then
  TOTAL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CACHE_DIR/updates.json','utf8')).length)")
else
  TOTAL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CACHE_DIR/new-rows.json','utf8')).length)")
fi

echo "Phase '$PHASE': $TOTAL total rows, chunk size $CHUNK, apply=${APPLY:-no}, start=$START"

OFFSET=$START
while [ "$OFFSET" -lt "$TOTAL" ]; do
  echo ">>> $PHASE slice offset=$OFFSET count=$CHUNK"
  ATTEMPT=1
  while true; do
    npx tsx scripts/import-botox-enrichment.ts --phase "$PHASE" --offset "$OFFSET" --count "$CHUNK" $APPLY
    STATUS=$?
    if [ "$STATUS" -eq 0 ]; then
      break
    fi
    if [ "$ATTEMPT" -ge "$MAX_RETRIES" ]; then
      echo "!!! $PHASE slice offset=$OFFSET failed after $ATTEMPT attempts. Aborting run."
      exit 1
    fi
    echo "!!! $PHASE slice offset=$OFFSET failed (attempt $ATTEMPT/$MAX_RETRIES, likely a DB connection drop). Retrying with a fresh process in 5s..."
    ATTEMPT=$((ATTEMPT + 1))
    sleep 5
  done
  OFFSET=$((OFFSET + CHUNK))
done

echo "Phase '$PHASE' complete: $TOTAL rows processed."
