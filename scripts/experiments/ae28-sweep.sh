#!/usr/bin/env bash
# AE28 pure-width at fixed iterations (extreme regime): 48 samples vs 6, both @ 500
# iters / beam 20, head-to-head 2v2. No wall-clock/iteration-matching — fixed iters
# is the point (isolates the pure-width term F17 could not, for the no-time-budget
# extreme tier). Fixed-iteration MCTS ⇒ contention changes only wall-time, never
# strength, so safe to oversubscribe (AE19 argument).
# 24 single-seed batches (25 games each, n=600), pooled with stats.py --pool.
# Resumable: a batch whose .result holds a RESULT line is skipped (survives reboots
# when OUT is in-repo, not /tmp).
set -u
cd "$(dirname "$0")/../.."
OUT="${1:?usage: ae28-sweep.sh <outdir>}"
mkdir -p "$OUT"
MAXJOBS="${MAXJOBS:-14}"
GAMES=25
BATCHES=24

CONFIGS=(ae28-extreme-width)

gate() { while (( $(jobs -rp | wc -l) >= MAXJOBS )); do wait -n; done; }

for cfg in "${CONFIGS[@]}"; do
  for b in $(seq 1 "$BATCHES"); do
    if grep -q '^RESULT' "$OUT/${cfg}-b${b}.result" 2>/dev/null; then continue; fi
    gate
    ( npx vite-node src/game/ai/arena.cli.ts "$GAMES" 1 "$b" \
        --config="scripts/experiments/${cfg}.json" --result 2>/dev/null \
        | grep '^RESULT' > "$OUT/${cfg}-b${b}.result.tmp" \
      && mv "$OUT/${cfg}-b${b}.result.tmp" "$OUT/${cfg}-b${b}.result" ) &
  done
done
wait
echo "all batches done -> $OUT"
