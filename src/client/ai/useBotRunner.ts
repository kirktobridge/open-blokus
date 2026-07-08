import { useEffect, useState } from 'react';
import { Client } from 'boardgame.io/client';
import { Step } from 'boardgame.io/ai';
import type { Bot } from 'boardgame.io/ai';

type GameClient = ReturnType<typeof Client>;

export interface BotRunnerStatus {
  /** True while a bot seat is deliberating (its delay + search). */
  thinking: boolean;
  /**
   * Wall-clock timestamp (`Date.now()`) the current deliberation began, or null
   * when no bot is thinking. Reset per move, so consumers can render live elapsed
   * time (P10 long-move feedback for the slow `extreme` tier).
   */
  since: number | null;
}

/**
 * Drives bot seats on a local client: whenever it's a bot's turn, wait the seat's
 * delay (for a watchable pace) then make one move via that seat's bot. Returns the
 * current thinking status (whether a bot is deliberating and when it started).
 * Self-perpetuates through client.subscribe — after each bot move the next bot
 * turn (if any) is scheduled.
 *
 * `botsBySeat` is keyed by playerID; a seat is a bot iff it has an entry. Each
 * seat gets its own difficulty (its own Bot instance and delay), so opponents can
 * be mixed easy/medium/hard/extreme.
 */
export function useBotRunner(
  client: GameClient,
  botsBySeat: Map<string, Bot>,
  delayForSeat: (seat: string) => number,
): BotRunnerStatus {
  const [status, setStatus] = useState<BotRunnerStatus>({ thinking: false, since: null });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let scheduledFor = -1;

    const tick = () => {
      const s = client.getState();
      const seat = s?.ctx.currentPlayer;
      if (!s || s.ctx.gameover || seat == null || !botsBySeat.has(seat)) {
        setStatus((prev) => (prev.thinking ? { thinking: false, since: null } : prev));
        return;
      }
      if (scheduledFor === s._stateID) return; // already scheduled for this state
      scheduledFor = s._stateID;
      // Fresh timestamp per move so elapsed time counts this deliberation only.
      setStatus({ thinking: true, since: Date.now() });
      const bot = botsBySeat.get(seat)!;
      timer = setTimeout(() => {
        if (!cancelled) void Step(client, bot);
      }, delayForSeat(seat));
    };

    const unsub = client.subscribe(() => tick());
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [client, botsBySeat, delayForSeat]);

  return status;
}
