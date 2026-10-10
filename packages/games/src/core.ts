import type { z } from "zod";

export type PlayerId = string;

/** Zwraca liczbę z przedziału [0, 1). */
export type Rng = () => number;

export type GameResult = { winner?: PlayerId; ranking?: PlayerId[] };

export interface GameDefinition<State, Move> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Kształt ruchu przychodzącego z sieci; reguły sprawdza dopiero validateMove. */
  moveSchema: z.ZodType<Move>;
  /** Tryby do wyboru w lobby, w kolejności wyświetlania; domyślny ma `default` (bez flagi: pierwszy). Gra bez trybów pomija to pole. */
  modes?: { id: string; name: string; hint: string; default?: boolean }[];
  /** `mode` to id z `modes` wybrane przez gospodarza; nieznane albo brak oznacza tryb domyślny. */
  setup(players: PlayerId[], rng: Rng, mode?: string): State;
  validateMove(state: State, player: PlayerId, move: Move): boolean;
  applyMove(state: State, player: PlayerId, move: Move, rng: Rng): State;
  /** Widok stanu dla konkretnego gracza: tu ukrywamy informacje. Obserwator dostaje widok dla "". */
  playerView(state: State, player: PlayerId): unknown;
  isOver(state: State): GameResult | null;
  /** Miejsca po końcu gry (od 1, remis = to samo miejsce). Mają je mini-gry: turniej liczy z nich punkty. */
  places?(state: State): Record<PlayerId, number>;
  /** Na kogo czekamy (ruch po kolei: jedna osoba; faza równoczesna: kilka); [] po końcu gry. */
  waitingFor(state: State): PlayerId[];
  /** Limit czasu tury; po nim platforma wykonuje timeoutMove za gracza. */
  turnSeconds?: number;
  /** Zamiast turnSeconds: limit zależny od fazy. Odlicza od nowa tylko przy zmianie key (np. STOP w Państwach-miastach). */
  turn?(state: State): { key: string; seconds: number };
  timeoutMove?(state: State, player: PlayerId, rng: Rng): Move;
}

/** mulberry32: mały, deterministyczny generator. Ten sam seed daje ten sam ciąg (testy, powtórki). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bez O/0, I/1/L, żeby kod dało się bezbłędnie przepisać z ekranu kolegi. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 4;

export function roomCode(rng: Rng): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Ranking gry, w której każdy oddaje jeden wynik (mini-gry). null, dopóki ktoś nie oddał.
 * Przy remisie kolejność miejsc; zwycięzca tylko przy 2+ graczach i bez remisu na górze (solo nie nabija statystyk).
 */
export function rankResults<R>(players: PlayerId[], results: Record<PlayerId, R>, compare: (a: R, b: R) => number): GameResult | null {
  if (!players.every((p) => p in results)) return null;
  const ranking = [...players].sort((a, b) => compare(results[a], results[b]));
  const clear = ranking.length > 1 && compare(results[ranking[0]], results[ranking[1]]) !== 0;
  return clear ? { winner: ranking[0], ranking } : { ranking };
}

/** Miejsca z remisami: 1 + liczba graczy ze ściśle lepszym wynikiem. Tylko po końcu gry (każdy ma wynik). */
export function rankPlaces<R>(players: PlayerId[], results: Record<PlayerId, R>, compare: (a: R, b: R) => number): Record<PlayerId, number> {
  return Object.fromEntries(players.map((p) => [p, 1 + players.filter((q) => compare(results[q], results[p]) < 0).length]));
}

/** `isOver` i `places` mini-gry z jednego komparatora, żeby ranking i miejsca nie mogły się rozjechać. */
export const ranked = <S extends { players: PlayerId[] }, R>(results: (state: S) => Record<PlayerId, R>, compare: (a: R, b: R) => number) => ({
  isOver: (state: S) => rankResults(state.players, results(state), compare),
  places: (state: S) => rankPlaces(state.players, results(state), compare),
});

/** Tasuje kopię tablicy (Fisher-Yates). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const average = (times: number[]) => (times.length ? times.reduce((a, b) => a + b, 0) / times.length : Infinity);

/** Porównanie wyników „na trafienia”: więcej trafień wyżej, przy równej liczbie niższa średnia czasu. */
export const byHitsThenAverage = (a: { times: number[] }, b: { times: number[] }) =>
  // Dwa puste wyniki to remis: Infinity - Infinity dałoby NaN, a NaN !== 0 robiło zwycięzcę z pierwszego gracza.
  b.times.length - a.times.length || (a.times.length ? average(a.times) - average(b.times) : 0);

/** Porównanie wyników „na punkty” (Stój!, Obrót): więcej punktów wyżej, przy równych niższa średnia czasu; dwa wyniki bez trafień to remis. */
export const byScoreThenAverage =
  <R extends { times: number[] }>(score: (r: R) => number) =>
  (a: R, b: R) =>
    score(b) - score(a) || (a.times.length || b.times.length ? average(a.times) - average(b.times) : 0);
