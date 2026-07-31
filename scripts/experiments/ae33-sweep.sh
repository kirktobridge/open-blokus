#!/usr/bin/env bash
# AE33 Phase 2/3 — Duo `extreme` iteration sweep. Phase 1 (ae33-phase1.ts) fixes which
# arms are admissible under the pre-registered 6000 ms p95 cap; only those are passed
# in here. Structure follows ae30-sweep.sh (AE30's driver, reused per the entry).
#
# Every config is fixed-iteration on BOTH sides (extreme candidate vs hard at 950), so
# contention changes wall-time but never strength — oversubscribing is safe (the AE19
# argument) and shards pool cleanly.
#
#   ./ae33-sweep.sh <outdir> <stage> <config...>
#     screen   n=200/matchup  (8 × 25) — directional only per M1, locates the arm
#     confirm  n=600/matchup  (24 × 25) — the pre-registered 52% bar
#     pool     n=600/matchup  (24 × 25) at a seed offset — independent second batch,
#              pooled with confirm to n≥1200 (the entry's Power line asks for this)
#
# Resumable: a batch whose .result holds a RESULT line is skipped.
set -u
cd "$(dirname "$0")/../.."
OUT="${1:?usage: ae33-sweep.sh <outdir> <screen|confirm|pool> <config...>}"
STAGE="${2:?usage: ae33-sweep.sh <outdir> <screen|confirm|pool> <config...>}"
shift 2
CONFIGS=("$@")
(( ${#CONFIGS[@]} )) || { echo "no configs given" >&2; exit 1; }
mkdir -p "$OUT"
MAXJOBS="${MAXJOBS:-14}"
GAMES=25

# Batch index = arena base seed. Each stage offsets past the previous one so its games
# are independent draws, not a re-pool of the same seeds.
case "$STAGE" in
  screen)  BATCHES=8;  SEED_OFFSET="${SEED_OFFSET:-100}" ;;
  confirm) BATCHES=24; SEED_OFFSET="${SEED_OFFSET:-200}" ;;
  pool)    BATCHES=24; SEED_OFFSET="${SEED_OFFSET:-400}" ;;
  *) echo "unknown stage: $STAGE" >&2; exit 1 ;;
esac

gate() { while (( $(jobs -rp | wc -l) >= MAXJOBS )); do wait -n; done; }

for cfg in "${CONFIGS[@]}"; do
  for b in $(seq 1 "$BATCHES"); do
    if grep -q '^RESULT' "$OUT/${cfg}-b${b}.result" 2>/dev/null; then continue; fi
    gate
    ( npx vite-node src/game/ai/arena.cli.ts "$GAMES" 1 "$(( b + SEED_OFFSET ))" \
        --config="scripts/experiments/${cfg}.json" --result 2>/dev/null \
        | grep '^RESULT' > "$OUT/${cfg}-b${b}.result.tmp" \
      && mv "$OUT/${cfg}-b${b}.result.tmp" "$OUT/${cfg}-b${b}.result" ) &
  done
done
wait

# Completeness gate: a driver that exits 0 having run nothing is the trap M-proxy names.
fail=0
for cfg in "${CONFIGS[@]}"; do
  have=$(grep -l '^RESULT' "$OUT/${cfg}-b"*.result 2>/dev/null | wc -l)
  echo "  ${cfg}: ${have}/${BATCHES} batches"
  (( have == BATCHES )) || fail=1
done
(( fail == 0 )) || { echo "INCOMPLETE — do not pool these shards" >&2; exit 1; }
echo "all batches done -> $OUT"
