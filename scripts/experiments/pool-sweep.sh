#!/usr/bin/env bash
# Seed-sharded population-play round-robin over pool.json (built for AE21, kept as
# general pool infrastructure — see lib/shards.ts on the naming). The whole pool
# is fixed-work — fixed-iteration MCTS (champion 500, mcts-150, mcts-30), fixed-depth
# alphabeta, and instant heuristic/greedy/random — so CPU contention changes only
# wall-time, never any player's strength (the AE19/AE28 oversubscription argument).
#
# Resumability makes this the cache the ladder's incremental recalibration reuses,
# so its outdir belongs in the repo (scripts/experiments/pool-shards/) and committed.
#
# Each batch runs the full `--pool` round-robin at a distinct baseSeed and emits the
# per-pairing RESULT lines to its own .result file; pool-report.ts sums them across
# batches, refits Bradley-Terry Elo, and reports Wilson CIs. Members are a subset arg,
# so the cheap (champion-free) and expensive (champion) cells can be swept separately
# and pooled together — cells carry independent n.
#
# Resumable: a batch whose .result already holds a RESULT line is skipped (survives
# reboots as long as OUT is in-repo, not /tmp).
#
# Usage: pool-sweep.sh <outdir> <members> [batches] [games-per-batch]
#   pool-sweep.sh scripts/experiments/pool-shards/A random,greedy-size,heuristic,alphabeta-d2,mcts-30,mcts-150 50 4
set -u
cd "$(dirname "$0")/../.."
OUT="${1:?usage: pool-sweep.sh <outdir> <members> [batches] [games]}"
MEMBERS="${2:?need a comma-separated members list}"
BATCHES="${3:-50}"
GAMES="${4:-4}"
MAXJOBS="${MAXJOBS:-14}"
mkdir -p "$OUT"

gate() { while (( $(jobs -rp | wc -l) >= MAXJOBS )); do wait -n; done; }

for b in $(seq 1 "$BATCHES"); do
  f="$OUT/b${b}.result"
  if grep -q '^RESULT' "$f" 2>/dev/null; then continue; fi
  gate
  ( npx vite-node src/game/ai/arena.cli.ts "$GAMES" 1 "$b" \
      --pool=scripts/experiments/pool.json --members="$MEMBERS" --result 2>/dev/null \
      | grep '^RESULT' > "${f}.tmp" \
    && mv "${f}.tmp" "$f" ) &
done
wait
echo "all $BATCHES batches done ($MEMBERS) -> $OUT"
