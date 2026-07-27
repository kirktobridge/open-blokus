#!/usr/bin/env bash
# AE30 Phase 2 — Duo beam sweep. Phase 1 measured iters/beam drifting 6.4× (medium)
# and 6.2× (hard) vs Classic, so the >2× Phase-2 gate fires: the ms-budgeted tiers
# complete far more iterations on 14×14 than the Classic-tuned beams were sized for.
#
# Each config is a fixed-iteration head-to-head (candidate beam vs shipped beam) at
# the iteration count Phase 1 measured for that tier's Duo time budget. Fixed
# iterations ⇒ contention changes wall-time, never strength, so oversubscribing is
# safe (the AE19 argument) and shards pool cleanly.
#
# Stage: SCREEN (n=200/matchup, directional only per M1) then CONFIRM (n=600) on the
# winner. Pass the stage as $2.
#   ./ae30-sweep.sh <outdir> [screen|confirm]
# Resumable: a batch whose .result holds a RESULT line is skipped.
set -u
cd "$(dirname "$0")/../.."
OUT="${1:?usage: ae30-sweep.sh <outdir> [screen|confirm|bracket]}"
STAGE="${2:-screen}"
mkdir -p "$OUT"
MAXJOBS="${MAXJOBS:-14}"
GAMES=25
# Batch index = arena base seed. The confirm stage offsets past the screen's
# batches so its games are independent draws, not a re-pool of the screen.
SEED_OFFSET="${SEED_OFFSET:-0}"

case "$STAGE" in
  screen)
    BATCHES=8   # 8 × 25 = n=200 per matchup (directional gate)
    CONFIGS=(ae30-medium-b16 ae30-medium-b42 ae30-hard-b48 ae30-hard-b158)
    ;;
  bracket)
    BATCHES=8   # n=200, directional — locates the optimum, does not adopt anything
    CONFIGS=(ae30-medium-b24)
    ;;
  confirm)
    BATCHES=24  # 24 × 25 = n=600 per matchup (the pre-registered 52% bar)
    CONFIGS=(ae30-medium-b16)
    ;;
  ladder)
    # Success criterion (a): every adjacent Duo step CI-clear of 50%. Tiers run at
    # the fixed iteration counts Phase 1 measured for their Duo time budgets
    # (medium 250, hard 950; extreme is fixed-iteration already) so the ladder is
    # shardable and deterministic — a time-budgeted ladder cannot be, and would
    # confound strength with contention.
    BATCHES=24
    CONFIGS=(ae30-ladder-medium-easy ae30-ladder-hard-medium ae30-ladder-extreme-hard)
    ;;
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
echo "all batches done -> $OUT"
