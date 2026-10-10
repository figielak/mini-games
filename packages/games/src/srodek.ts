import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults } from "./core.ts";

export const ROUNDS = 10;
/** Bok pola w umownych px: wynik nie zależy od rozmiaru telefonu. */
export const FIELD = 300;
/** Większy błąd i tak znaczy „zupełnie obok” (pół pola). */
export const MAX_DISTANCE = 150;
/** Długość odcinka i odstęp końców od krawędzi, w ułamkach boku pola. */
export const MIN_LEN = 0.25;
export const MAX_LEN = 0.7;
export const MARGIN = 0.1;

/** Pozycja na polu, 0-1 w obu osiach. */
export type Point = { x: number; y: number };
export type Segment = { a: Point; b: Point };

/** Pusta lista = limit czasu (kara jak za same dotknięcia zupełnie obok). */
export type Move = { type: "result"; taps: Point[] };

export interface State {
  players: PlayerId[];
  segments: Segment[];
  /** Suma odległości w dziesiątych częściach px (int). */
  results: Record<PlayerId, number>;
  taps: Record<PlayerId, Point[]>;
}

export type View = State;

/** Odległość dotknięcia od środka odcinka w umownych px, ucięta do MAX_DISTANCE. */
export function distance({ a, b }: Segment, tap: Point): number {
  return Math.min(MAX_DISTANCE, Math.hypot((a.x + b.x) / 2 - tap.x, (a.y + b.y) / 2 - tap.y) * FIELD);
}

// Losowy środek, kąt i długość; odrzucane, dopóki któryś koniec wychodzi poza margines (średnio kilka prób).
function segment(rng: () => number): Segment {
  for (;;) {
    const x = MARGIN + rng() * (1 - 2 * MARGIN);
    const y = MARGIN + rng() * (1 - 2 * MARGIN);
    const angle = rng() * Math.PI;
    const half = (MIN_LEN + rng() * (MAX_LEN - MIN_LEN)) / 2;
    const dx = Math.cos(angle) * half;
    const dy = Math.sin(angle) * half;
    const ends = { a: { x: x - dx, y: y - dy }, b: { x: x + dx, y: y + dy } };
    if ([ends.a.x, ends.a.y, ends.b.x, ends.b.y].every((v) => v >= MARGIN && v <= 1 - MARGIN)) return ends;
  }
}

const valid = ({ x, y }: Point) => [x, y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1);

// ponytail: odcinki są w widoku od startu (jak kropki w Policz kropki), da się podejrzeć; między znajomymi wystarczy.
export const srodek: GameDefinition<State, Move> = {
  id: "srodek",
  name: "Środek",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 60,
  moveSchema: z.object({
    type: z.literal("result"),
    taps: z.array(z.object({ x: z.number(), y: z.number() })).max(ROUNDS),
  }),

  setup: (players, rng) => ({
    players,
    segments: Array.from({ length: ROUNDS }, () => segment(rng)),
    results: {},
    taps: {},
  }),

  validateMove: (state, player, { taps }) =>
    state.players.includes(player) && !(player in state.results) && (taps.length === 0 || (taps.length === ROUNDS && taps.every(valid))),

  applyMove: (state, player, { taps }) => {
    const sum = taps.length ? state.segments.reduce((s, seg, i) => s + distance(seg, taps[i]), 0) : ROUNDS * MAX_DISTANCE;
    return {
      ...state,
      results: { ...state.results, [player]: Math.round(sum * 10) },
      taps: { ...state.taps, [player]: taps },
    };
  },

  playerView: (state): View => state,

  isOver: (state) => rankResults(state.players, state.results, (a, b) => a - b),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", taps: [] }),
};
