#!/usr/bin/env bash
# Incremental ladder recalibration (P62).
#
# Adding a bot to the pool invalidates the committed ladder, but re-running the whole
# round-robin to rate one newcomer is wasteful: only the newcomer's k pairs are
# actually unknown. This runs *those* pairs into the shard cache and refits, leaving
# every existing pair's shards untouched — the cache is what makes the difference
# (a heuristic-class add is ~1-2 CPU-h against ~85 for the full 7-member pool).
#
# The saving is real only because the shards are committed. They were not, before
# P62: AE21's original sweep wrote to a scratch dir that was later deleted, so the
# first ladder had to be regenerated from nothing. Keep pool-shards/ in the repo.
#
# What this does NOT do: decide the anchor model. `bradleyTerryElo` mean-centers, so
# adding a member shifts every published rating even though nobody got stronger. That
# is P62's open decision (frozen-anchor/provisional vs periodic full re-fit), settled
# with P61 — until then, treat post-add ratings as a re-fit of the whole pool.
#
# Usage: ladder-recal.sh <new-member> [batches] [games-per-batch]
#   ladder-recal.sh newbot 40 1          # directional n=40 vs each existing member
#
# Pre-req: add the member to pool.json first (this reads its name list from there).
set -u
cd "$(dirname "$0")/../.."

NEW="${1:?usage: ladder-recal.sh <new-member> [batches] [games]}"
BATCHES="${2:-40}"
GAMES="${3:-1}"
POOL=scripts/experiments/pool.json
CACHE=scripts/experiments/pool-shards

members() { node -e '
  const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  console.log(p.members.map((m) => m.name).join("\n"));
' "$POOL"; }

if ! members | grep -qx "$NEW"; then
  echo "error: '$NEW' is not in $POOL — add it there first, then rerun." >&2
  echo "pool members:" >&2
  members | sed 's/^/  /' >&2
  exit 1
fi

OPPONENTS=$(members | grep -vx "$NEW")
echo ">>> recalibrating '$NEW' against $(echo "$OPPONENTS" | wc -l) existing members"
echo ">>> reusing shard cache at $CACHE (existing pairs are never re-run)"

for opp in $OPPONENTS; do
  echo ">>> $NEW vs $opp"
  bash scripts/experiments/pool-sweep.sh "$CACHE/pairs/${NEW}__vs__${opp}" "$NEW,$opp" "$BATCHES" "$GAMES"
done

echo ">>> refitting the ladder over the whole cache"
# The bin directly, not `npx`: npx parses `--flag=value` as its own npm config and
# refuses to run the script.
./node_modules/.bin/vite-node scripts/experiments/ladder-build.ts "$CACHE" \
  --source="incremental recalibration: +$NEW (ladder-recal.sh)"

echo
echo "Done. Review the diff in src/game/ai/ladder/classic.json and commit it together"
echo "with the new $CACHE/pairs/ shards — the artifact and its evidence land as one."
