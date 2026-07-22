#!/usr/bin/env bash
# Mutation testing for the rules core (npm run mutate).
#
# Runs Stryker ONE FILE AT A TIME. Instrumenting all the hot files
# (board/moves/placement/pieces/bitboard) at once pushes Stryker's `perTest`
# coverage past its 5-min dry-run timeout even with the trimmed test set (see
# vitest.mutate.config.ts) — a bare `stryker run` over the whole core hangs and
# dies. Per-file scope keeps each dry run ~35s and, as a bonus, yields a score
# per file (which file has weak tests) instead of one opaque aggregate.
#
#   npm run mutate                     # whole rules core, file by file
#   npm run mutate src/game/moves.ts   # one file (or any Stryker --mutate glob)
set -uo pipefail
cd "$(dirname "$0")/.."

# Scoped run: pass args straight through to Stryker's --mutate.
if [ "$#" -gt 0 ]; then
  exec npx stryker run --mutate "$@"
fi

# Whole-core run: the deterministic rules core, excluding barrels/types. The AI
# subtree (src/game/ai/**) is intentionally out of scope — stochastic + no unit
# coverage on its CLI entry points.
files=$(ls src/game/*.ts src/game/puzzle/*.ts | grep -vE 'index\.ts|types\.ts|\.test\.')
fail=0
for f in $files; do
  echo "=== $f ==="
  if ! npx stryker run --mutate "$f" --reporters clear-text 2>&1 \
      | grep -E "^ ?$(basename "$f") \|"; then
    echo "  !! no score row for $f — the run failed, see output above"
    fail=1
  fi
done
exit "$fail"
