import { createContext, useContext } from 'react';

export interface SessionActions {
  onPlayAgain: () => void;
  onLeave: () => void;
}

/** Lets in-client UI (e.g. GameOverModal) trigger lobby actions that live in App. */
export const SessionActionsContext = createContext<SessionActions | null>(null);

export const useSessionActions = (): SessionActions | null =>
  useContext(SessionActionsContext);
