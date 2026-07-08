#!/usr/bin/env bash
# AE19 strength sweep: our fixed-iteration MCTS tiers vs Pentobi levels, 2v2.
# Fixed-iteration (and Pentobi's simulation-based levels) means CPU contention
# changes only wall-time, never any player's strength — safe to oversubscribe.
# Each (tier,level) is split into seed batches run in parallel, then pooled.
set -u
cd "$(dirname "$0")/../.."
OUT="${1:?usage: ae19-sweep.sh <outdir>}"
mkdir -p "$OUT"
RUN="npx vite-node src/game/ai/pentobi/run.ts"
MAXJOBS="${MAXJOBS:-7}"

# matrix: "config level games seeds_per_batch batches"  (games*seeds*batches = n)
JOBS=(
  # easy tier (heuristic) — instant moves, one process each, n=240
  "ae19-heuristic-L4 1 60 4 1"
  "ae19-heuristic-L4 2 60 4 1"
  "ae19-heuristic-L4 3 60 4 1"
  "ae19-heuristic-L4 4 60 4 1"
  # fixed-iteration MCTS-150 (strong tier) — 4 seed batches, n=200
  "ae19-mcts150 1 50 1 4"
  "ae19-mcts150 2 50 1 4"
  "ae19-mcts150 3 50 1 4"
  # extreme (500 iters) — slow, directional probe vs L1, n=40
  "ae19-extreme-L4 1 10 1 4"
)

gate() { while (( $(jobs -rp | wc -l) >= MAXJOBS )); do wait -n; done; }

for spec in "${JOBS[@]}"; do
  read -r cfg lvl games spb batches <<<"$spec"
  for b in $(seq 1 "$batches"); do
    gate
    tag="${cfg}-L${lvl}-b${b}"
    ( $RUN --config="scripts/experiments/${cfg}.json" --level="$lvl" \
        --games="$games" --seeds="$spb" --baseSeed="$b" 2>/dev/null \
        | grep '^RESULT' > "$OUT/${tag}.result" ) &
  done
done
wait
echo "all batches done -> $OUT"
