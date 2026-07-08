/**
 * Async wrapper around a persistent `pentobi-gtp` subprocess (AE19).
 *
 * GTP is a line protocol: a command is one line on stdin; the response is
 * `= <text>` (success) or `? <text>` (failure) terminated by a blank line. We
 * keep one long-lived engine per tournament (Pentobi is stateless about turn
 * order — every command carries its color — so a single process can play any
 * subset of the four seats). Commands are serialised through a FIFO waiter
 * queue: GTP answers in order, so the i-th response resolves the i-th promise.
 *
 * The engine is not shipped in the repo — it is built from source (see the AE19
 * log run for steps) and located via `PENTOBI_GTP` env or an explicit path.
 */
import { spawn, type ChildProcess } from 'node:child_process';

export interface GtpOptions {
  binPath: string;
  /** Pentobi game variant; 4-player Classic is "classic". */
  variant?: string;
  level: number;
  /** Search threads. Default 1 — multi-threaded MCTS is non-deterministic. */
  threads?: number;
  /** Disable resign so games always play to completion (score-based winner). */
  noResign?: boolean;
}

interface Waiter {
  resolve: (s: string) => void;
  reject: (e: Error) => void;
}

export class GtpEngine {
  private proc: ChildProcess;
  private buf = '';
  private waiters: Waiter[] = [];
  private exited = false;

  constructor(opts: GtpOptions) {
    const args = ['-g', opts.variant ?? 'classic', '-l', String(opts.level), '--quiet'];
    args.push('--threads', String(opts.threads ?? 1));
    if (opts.noResign ?? true) args.push('--noresign');
    this.proc = spawn(opts.binPath, args, { stdio: ['pipe', 'pipe', 'ignore'] });
    this.proc.stdout!.setEncoding('utf8');
    this.proc.stdout!.on('data', (c: string) => this.onData(c));
    this.proc.on('exit', (code, signal) => {
      this.exited = true;
      const err = new Error(`pentobi-gtp exited early (code ${code}, signal ${signal})`);
      while (this.waiters.length) this.waiters.shift()!.reject(err);
    });
    this.proc.on('error', (e) => {
      this.exited = true;
      while (this.waiters.length) this.waiters.shift()!.reject(e);
    });
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    let i: number;
    // Responses are separated by a blank line (GTP terminator).
    while ((i = this.buf.indexOf('\n\n')) >= 0) {
      const resp = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 2);
      const w = this.waiters.shift();
      if (!w) continue;
      if (resp.startsWith('?')) w.reject(new Error(`GTP failure: ${resp.replace(/^\?\s?/, '')}`));
      else w.resolve(resp.replace(/^=\s?/, '').trim());
    }
  }

  /** Send a raw GTP command and resolve with its response body. */
  cmd(command: string): Promise<string> {
    if (this.exited) return Promise.reject(new Error('pentobi-gtp is not running'));
    return new Promise<string>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      this.proc.stdin!.write(command + '\n');
    });
  }

  async clearBoard(): Promise<void> {
    await this.cmd('clear_board');
  }
  async setSeed(seed: number): Promise<void> {
    await this.cmd(`set_random_seed ${seed >>> 0}`);
  }
  /** Apply an opponent (our-bot) move to Pentobi's internal board. */
  async play(color: string, move: string): Promise<void> {
    await this.cmd(`play ${color} ${move}`);
  }
  /** Ask Pentobi to move for `color`; auto-applies to its board. "pass" if stuck. */
  genmove(color: string): Promise<string> {
    return this.cmd(`genmove ${color}`);
  }
  /** Space-separated per-color scores "blue yellow red green". */
  finalScore(): Promise<string> {
    return this.cmd('final_score');
  }

  async quit(): Promise<void> {
    if (!this.exited) {
      try {
        await this.cmd('quit');
      } catch {
        /* already gone */
      }
    }
    this.proc.kill();
  }
}
