import { z } from "zod";
import type { GameResult, PlayerId } from "./core.ts";

/** Kolory graczy: dane, nie akcent. Żaden nie przypomina czerwieni akcentu (#ff2445). */
export const PLAYER_COLORS = ["#3b9eff", "#ffc53d", "#46a758", "#8e7cff", "#0ac5b3", "#f76fbe"] as const;

export const MAX_PLAYERS = PLAYER_COLORS.length;
export const NICK_MAX = 16;
/** Tyle trwa ekran instrukcji mini-gry; potem gra rusza sama, żeby nikt nie blokował pozostałych. */
export const INTRO_SECONDS = 15;

export interface LobbyPlayer {
  id: PlayerId;
  nick: string;
  color: string;
  connected: boolean;
  /** Gość potwierdził, że jest gotów do wybranej gry. Gospodarza nie dotyczy: on daje start. */
  ready: boolean;
}

export type Phase = "lobby" | "playing" | "over";

export interface RoomView {
  code: string;
  hostId: PlayerId;
  players: LobbyPlayer[];
  phase: Phase;
  gameId: string | null;
  /** Tryb wybranej gry (id z `modes`); null, gdy gra nie ma trybów. */
  mode: string | null;
  /** Kto gra w wybranej grze, w kolejności ruchów. Reszta ogląda. */
  seats: PlayerId[];
  /** Wygrane partie w tym pokoju. */
  scores: Record<PlayerId, number>;
  game: {
    view: unknown;
    /** Na kogo czekamy: gracz na turze albo kilku naraz (np. rozstawianie statków). */
    waitingFor: PlayerId[];
    /** Ile zostało do końca tury; liczone od chwili odebrania wiadomości (zegary telefonu i serwera się różnią). */
    msLeft: number | null;
    /** Trwa ekran instrukcji mini-gry: limit jeszcze nie ruszył, a msLeft liczy czas do automatycznego startu. */
    intro: boolean;
    /** Kto kliknął już „Start” na ekranie instrukcji. */
    began: PlayerId[];
    result: GameResult | null;
  } | null;
}

/** Zwraca oczyszczony nick albo null, gdy się nie nadaje. */
export function cleanNick(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const nick = raw.trim().replace(/\s+/g, " ");
  return nick.length >= 1 && nick.length <= NICK_MAX ? nick : null;
}

/** Schematy wiadomości od klienta do pokoju; serwer odrzuca wszystko, co do nich nie pasuje. */
export const ROOM_MESSAGES = {
  pickGame: z.object({ gameId: z.string() }),
  pickMode: z.object({ mode: z.string() }),
  toggleSeat: z.object({ id: z.string() }),
  pickColor: z.object({ color: z.enum(PLAYER_COLORS) }),
  ready: z.object({ ready: z.boolean() }),
  start: z.unknown(),
  // „Start” na ekranie instrukcji mini-gry.
  begin: z.unknown(),
  rematch: z.unknown(),
  toLobby: z.unknown(),
  // Kształt ruchu sprawdza moveSchema wybranej gry.
  move: z.unknown(),
};
