#!/usr/bin/env bash
# Champion cells of the pool round-robin: champion (500-iter extreme, ~131 s/game)
# vs each other pool member,
# run as isolated 2-member pair-sweeps. Each pair is its own round-robin (one cell each
# way), so these result files hold *only* champion↔X cells — pooling them with the
# champion-free Sweep A never double-counts a shared cell, even though both start from
# baseSeed 1 (A's cells and B's cells are disjoint). Directional n by design; the
# champion is the P13 anchor, not a hypothesis-under-test.
#
# Usage: pool-champion.sh <outdir> [batches] [games-per-batch]
set -u
cd "$(dirname "$0")"
OUT="${1:?usage: pool-champion.sh <outdir> [batches] [games]}"
BATCHES="${2:-40}"
GAMES="${3:-1}"
OPPONENTS=(random greedy-size heuristic alphabeta-d2 mcts-30 mcts-150)

for opp in "${OPPONENTS[@]}"; do
  echo ">>> champion vs $opp"
  MAXJOBS="${MAXJOBS:-14}" bash pool-sweep.sh "$OUT/$opp" "champion,$opp" "$BATCHES" "$GAMES"
done
echo "champion cells done -> $OUT"
