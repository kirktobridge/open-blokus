#!/usr/bin/env bash
# AE11 rollout-policy sweep: each candidate policy vs the shipped size-greedy
# rollout, head-to-head 2v2, at matched wall-clock (iteration counts set from
# scripts/bench-rollout.ts throughput; see the run record).
#
# Fixed-iteration MCTS means CPU contention changes only wall-time, never any
# player's strength — safe to oversubscribe (the AE19 sweep argument).
# Each comparison is split into 24 single-seed batches (25 games each, n=600),
# run in parallel and pooled with .claude/skills/research/stats.py --pool.
set -u
cd "$(dirname "$0")/../.."
OUT="${1:?usage: ae11-sweep.sh <outdir>}"
mkdir -p "$OUT"
MAXJOBS="${MAXJOBS:-14}"
GAMES=25
BATCHES=24

CONFIGS=(ae11-score ae11-softmax ae11-samples12)

gate() { while (( $(jobs -rp | wc -l) >= MAXJOBS )); do wait -n; done; }

for cfg in "${CONFIGS[@]}"; do
  for b in $(seq 1 "$BATCHES"); do
    gate
    ( npx vite-node src/game/ai/arena.cli.ts "$GAMES" 1 "$b" \
        --config="scripts/experiments/${cfg}.json" --result 2>/dev/null \
        | grep '^RESULT' > "$OUT/${cfg}-b${b}.result" ) &
  done
done
wait
echo "all batches done -> $OUT"
