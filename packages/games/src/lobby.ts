import type { PlayerId } from "./core.ts";

/** Kolory graczy: dane, nie akcent. Żaden nie przypomina czerwieni akcentu (#ff2445). */
export const PLAYER_COLORS = ["#3b9eff", "#ffc53d", "#46a758", "#8e7cff", "#0ac5b3", "#f76fbe"] as const;

export const MAX_PLAYERS = PLAYER_COLORS.length;
export const NICK_MAX = 16;

export interface LobbyPlayer {
  id: PlayerId;
  nick: string;
  color: string;
  connected: boolean;
}

export interface LobbyView {
  code: string;
  hostId: PlayerId;
  players: LobbyPlayer[];
}

/** Zwraca oczyszczony nick albo null, gdy się nie nadaje. */
export function cleanNick(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const nick = raw.trim().replace(/\s+/g, " ");
  return nick.length >= 1 && nick.length <= NICK_MAX ? nick : null;
}
