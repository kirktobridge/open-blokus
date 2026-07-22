#!/usr/bin/env python3
"""
Keep a Playwright run from OOM-killing the WSL2 guest.

Playwright's default worker count is half the cores — a CPU heuristic that ignores
memory. On this 16-core / 16GB WSL2 box that means 8 Chromium instances alongside the
three webServers (and whatever a parallel dev session is holding), which has taken the
whole VM down mid-run. playwright.config.ts now derives a memory-aware default, so the
common paths (`npm test`, a bare `npx playwright test`) are already safe.

This hook covers the hole the config can't: an explicit `--workers=N` / `PW_WORKERS=N`
on the command line *overrides* that default. It re-checks such an override against
live MemAvailable and blocks it if the box can't afford it right now.

PreToolUse hook on Bash. Exit 0 = allow. Exit 2 = block, stderr goes back to Claude.
"""
import json
import os
import re
import sys

PER_WORKER_MB = 1024  # a Chromium instance + its page, with slack
SERVER_RESERVE_MB = 2048  # the 3 webServers, vite's transform cache, the OS
MAX_WORKERS = 4  # past this the suite is I/O-bound anyway — no upside to the risk

# `playwright test`, with or without an npx/rtk/pnpm prefix. Deliberately does NOT
# match `npm test`: that runs through playwright.config.ts, which already self-limits
# and cannot be handed a --workers flag anyway.
PLAYWRIGHT_RE = re.compile(r"\bplaywright\s+test\b")
# --workers=8 | --workers 8 | -j8 | -j 8
WORKERS_RE = re.compile(r"(?:--workers[=\s]+|-j\s*)(\d+)")
ENV_WORKERS_RE = re.compile(r"\bPW_WORKERS=(\d+)")


def available_mb() -> float:
    """MemAvailable — what the kernel says can actually be allocated. MemFree would
    count the page cache as used and understate headroom badly."""
    try:
        with open("/proc/meminfo") as fh:
            m = re.search(r"^MemAvailable:\s+(\d+) kB$", fh.read(), re.M)
        if m:
            return int(m.group(1)) / 1024
    except OSError:
        pass
    return float("inf")  # not Linux: nothing to protect, don't block


def affordable_workers() -> int:
    budget = int((available_mb() - SERVER_RESERVE_MB) // PER_WORKER_MB)
    return max(1, min(MAX_WORKERS, (os.cpu_count() or 2) // 2, budget))


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0  # never break the tool call over a malformed payload

    if payload.get("tool_name") != "Bash":
        return 0
    command = payload.get("tool_input", {}).get("command", "")
    if not PLAYWRIGHT_RE.search(command):
        return 0

    match = WORKERS_RE.search(command) or ENV_WORKERS_RE.search(command)
    if not match:
        return 0  # no override — playwright.config.ts picks a safe number itself

    requested = int(match.group(1))
    safe = affordable_workers()
    if requested <= safe:
        return 0

    avail = int(available_mb())
    sys.stderr.write(
        f"Blocked: --workers={requested} risks OOM-killing the WSL2 guest.\n"
        f"Only {avail}MB is available right now; after reserving {SERVER_RESERVE_MB}MB "
        f"for the three webServers that is {safe} worker(s) at ~{PER_WORKER_MB}MB each.\n"
        f"Re-run with --workers={safe}, or just drop the flag — playwright.config.ts "
        f"derives this same budget on its own.\n"
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
