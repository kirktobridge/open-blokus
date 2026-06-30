import { useEffect, useState } from 'react';
import { Client } from 'boardgame.io/client';
import { Step } from 'boardgame.io/ai';
import type { Bot } from 'boardgame.io/ai';

type GameClient = ReturnType<typeof Client>;

/**
 * Drives bot seats on a local client: whenever it's a bot's turn, wait `delayMs`
 * (for a watchable pace) then make one move via Step. Returns whether a bot is
 * currently "thinking". Self-perpetuates through client.subscribe — after each
 * bot move the next bot turn (if any) is scheduled.
 */
export function useBotRunner(
  client: GameClient,
  botSeats: Set<string>,
  bot: Bot,
  delayMs: number,
): boolean {
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let scheduledFor = -1;

    const tick = () => {
      const s = client.getState();
      if (!s || s.ctx.gameover || !botSeats.has(s.ctx.currentPlayer)) {
        setThinking(false);
        return;
      }
      if (scheduledFor === s._stateID) return; // already scheduled for this state
      scheduledFor = s._stateID;
      setThinking(true);
      timer = setTimeout(() => {
        if (!cancelled) void Step(client, bot);
      }, delayMs);
    };

    const unsub = client.subscribe(() => tick());
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [client, bot, delayMs, botSeats]);

  return thinking;
}
