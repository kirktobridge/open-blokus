#!/usr/bin/env bash
# AE26 rollout-width sweep: each width {12,24,48} vs the shipped 6-sample rollout,
# plus a 6-sample iteration-confound control (57it vs 48it), head-to-head 2v2, at
# matched wall-clock (iteration counts set from scripts/bench-rollout.ts throughput:
# 12->57, 24->65, 48->65; base 6->48; see the run record).
#
# Fixed-iteration MCTS means CPU contention changes only wall-time, never any
# player's strength — safe to oversubscribe (the AE19 sweep argument).
# Each comparison is split into 24 single-seed batches (25 games each, n=600),
# run in parallel and pooled with .claude/skills/research/stats.py --pool.
set -u
cd "$(dirname "$0")/../.."
OUT="${1:?usage: ae26-sweep.sh <outdir>}"
mkdir -p "$OUT"
MAXJOBS="${MAXJOBS:-14}"
GAMES=25
BATCHES=24

CONFIGS=(ae26-samples12 ae26-samples24 ae26-samples48 ae26-control-iters)

gate() { while (( $(jobs -rp | wc -l) >= MAXJOBS )); do wait -n; done; }

# Resumable: a batch whose .result already holds a RESULT line is skipped, so a
# relaunch after an interrupted session only fills the gaps. Write to a tmp file
# and mv into place so a half-written file (killed mid-batch) never counts as done.
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
