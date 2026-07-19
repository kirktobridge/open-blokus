import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

// CI half of the doc-debt pairing contract (scripts/doc-debt-check.mjs owns the
// rules; a PostToolUse hook in the machine-local .claude/settings.json runs the
// same script in-session). Runs the CLI path the hook uses, so both enforcement
// points exercise identical code.
describe('doc debt pairing (product BACKLOG ↔ research backlog)', () => {
  it('every replication-pending debt is tracked on both sides', () => {
    // Non-zero exit → execFileSync throws with the script's stderr in the message.
    expect(() =>
      execFileSync('node', ['scripts/doc-debt-check.mjs', '--all'], {
        cwd: process.cwd(),
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
