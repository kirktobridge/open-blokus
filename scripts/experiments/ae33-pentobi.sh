#!/usr/bin/env bash
# AE33 Phase 3 — external anchor: place the retuned Duo `extreme` (1000 iters, beam 20,
# rolloutSamples 48) on the AE29 Pentobi Duo ladder, so the Phase-2 gain is anchored
# externally and not only self-relatively (M5).
#
# Baseline to beat is F20 / Run X, which measured the *shipped* 500-iter config:
#   vs Duo L1  52.8% [45.8, 59.6]  — statistically even, "inconclusive, not a win"
#   vs Duo L2  35.5% [29.2, 42.3]  — loses CI-clear
# Matching that run's n=200 per pairing (4 seeds × 50 games) so the comparison is like
# for like.
#
# The runner plays its seeds sequentially (`threads` is Pentobi's own engine threads,
# not harness parallelism), so parallelism here comes from launching one process per
# seed. Each emits a machine-parseable RESULT line; pooling is a sum over those.
#
#   ./ae33-pentobi.sh <outdir> [level...]     # default levels: 1 2
# Resumable: a seed whose .result holds a RESULT line is skipped.
set -u
cd "$(dirname "$0")/../.."
OUT="${1:?usage: ae33-pentobi.sh <outdir> [level...]}"
shift
LEVELS=("$@")
(( ${#LEVELS[@]} )) || LEVELS=(1 2)
mkdir -p "$OUT"
GAMES="${GAMES:-50}"
SEEDS="${SEEDS:-4}"
BASE="${BASE:-1}"
MAXJOBS="${MAXJOBS:-8}"

gate() { while (( $(jobs -rp | wc -l) >= MAXJOBS )); do wait -n; done; }

for L in "${LEVELS[@]}"; do
  for s in $(seq 0 $(( SEEDS - 1 ))); do
    seed=$(( BASE + s ))
    f="$OUT/L${L}-s${seed}.result"
    if grep -q '^RESULT' "$f" 2>/dev/null; then continue; fi
    gate
    ( npx vite-node src/game/ai/pentobi/run.ts \
        --config="scripts/experiments/ae33-pentobi-L${L}.json" \
        --variant=duo --games="$GAMES" --seeds=1 --baseSeed="$seed" 2>/dev/null \
        | grep '^RESULT' > "${f}.tmp" && mv "${f}.tmp" "$f" ) &
  done
done
wait

# Completeness gate — an exit 0 that ran nothing is the trap to avoid pooling over.
fail=0
for L in "${LEVELS[@]}"; do
  have=$(grep -l '^RESULT' "$OUT/L${L}-s"*.result 2>/dev/null | wc -l)
  echo "  L${L}: ${have}/${SEEDS} seeds"
  (( have == SEEDS )) || fail=1
done
(( fail == 0 )) || { echo "INCOMPLETE — do not pool these shards" >&2; exit 1; }
echo "all seeds done -> $OUT"
