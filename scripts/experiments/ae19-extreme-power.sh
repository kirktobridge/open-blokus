#!/usr/bin/env bash
# AE19 follow-up: power the extreme (500-iter) tier vs Pentobi to n>=200 so the
# ladder-placement claim clears M1 (n>=200) rather than staying directional.
# Fixed-iteration -> CPU contention changes only wall-time, never strength.
set -u
cd "$(dirname "$0")/../.."
OUT="${1:?usage: ae19-extreme-power.sh <outdir>}"
mkdir -p "$OUT"
RUN="npx vite-node src/game/ai/pentobi/run.ts"
MAXJOBS="${MAXJOBS:-12}"

# "level games batches"  -> n = games*batches (seeds_per_batch=1)
JOBS=(
  "1 10 20"   # extreme vs L1, n=200 (firm the boundary)
  "2 10 10"   # extreme vs L2, n=100 (pin the ceiling)
)

gate() { while (( $(jobs -rp | wc -l) >= MAXJOBS )); do wait -n; done; }

for spec in "${JOBS[@]}"; do
  read -r lvl games batches <<<"$spec"
  for b in $(seq 1 "$batches"); do
    gate
    tag="extreme-L${lvl}-b${b}"
    ( $RUN --config="scripts/experiments/ae19-extreme-L4.json" --level="$lvl" \
        --games="$games" --seeds=1 --baseSeed="$b" 2>/dev/null \
        | grep '^RESULT' > "$OUT/${tag}.result" ) &
  done
done
wait
echo "extreme power run done -> $OUT"
