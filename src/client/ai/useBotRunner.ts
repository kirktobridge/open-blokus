import { useEffect, useState } from 'react';
import { Client } from 'boardgame.io/client';
import { Step } from 'boardgame.io/ai';
import type { Bot } from 'boardgame.io/ai';

type GameClient = ReturnType<typeof Client>;

/**
 * Drives bot seats on a local client: whenever it's a bot's turn, wait the seat's
 * delay (for a watchable pace) then make one move via that seat's bot. Returns
 * whether a bot is currently "thinking". Self-perpetuates through client.subscribe
 * — after each bot move the next bot turn (if any) is scheduled.
 *
 * `botsBySeat` is keyed by playerID; a seat is a bot iff it has an entry. Each
 * seat gets its own difficulty (its own Bot instance and delay), so opponents can
 * be mixed easy/medium/hard/extreme.
 */
export function useBotRunner(
  client: GameClient,
  botsBySeat: Map<string, Bot>,
  delayForSeat: (seat: string) => number,
): boolean {
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let scheduledFor = -1;

    const tick = () => {
      const s = client.getState();
      const seat = s?.ctx.currentPlayer;
      if (!s || s.ctx.gameover || seat == null || !botsBySeat.has(seat)) {
        setThinking(false);
        return;
      }
      if (scheduledFor === s._stateID) return; // already scheduled for this state
      scheduledFor = s._stateID;
      setThinking(true);
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

  return thinking;
}
