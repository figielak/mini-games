import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults } from "./core.ts";

export const ROUNDS = 10;
/** Bok pola w umownych px: wynik nie zależy od rozmiaru telefonu. */
export const FIELD = 300;
/** Kara za rundę po limicie czasu; więcej niż najgorsza uczciwa runda (MAX_LEN / 2 × FIELD + ACCEPT_PX). */
export const MAX_DISTANCE = 150;
/** Strefa akceptacji: dotknięcie dalej od odcinka nie jest odpowiedzią (przypadkowe stuknięcie, próba nadużycia rzutowania). */
export const ACCEPT_PX = 30;
/** Długość odcinka i odstęp końców od krawędzi, w ułamkach boku pola. */
export const MIN_LEN = 0.25;
export const MAX_LEN = 0.7;
export const MARGIN = 0.1;

/** Pozycja na polu, 0-1 w obu osiach. */
export type Point = { x: number; y: number };
export type Segment = { a: Point; b: Point };

/** Pusta lista = limit czasu (MAX_DISTANCE za każdą rundę). */
export type Move = { type: "result"; taps: Point[] };

export interface State {
  players: PlayerId[];
  segments: Segment[];
  /** Suma błędów w dziesiątych częściach px (int). */
  results: Record<PlayerId, number>;
  taps: Record<PlayerId, Point[]>;
}

export type View = State;

/** Punkt prostej odcinka dla parametru t (0 = a, 1 = b). */
const along = ({ a, b }: Segment, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Parametr rzutu prostopadłego dotknięcia na prostą odcinka. */
function param({ a, b }: Segment, tap: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return ((tap.x - a.x) * dx + (tap.y - a.y) * dy) / (dx * dx + dy * dy);
}

/** Rzut prostopadły dotknięcia na prostą odcinka (może wypaść tuż za końcem). */
export const project = (segment: Segment, tap: Point): Point => along(segment, param(segment, tap));

/** Błąd rundy w umownych px: odległość rzutu od środka, wzdłuż odcinka. Odchylenie w bok nic nie kosztuje. */
export function distance(segment: Segment, tap: Point): number {
  const { a, b } = segment;
  return Math.abs(param(segment, tap) - 0.5) * Math.hypot(b.x - a.x, b.y - a.y) * FIELD;
}

/** Odległość dotknięcia od najbliższego punktu odcinka w umownych px (do strefy akceptacji). */
export function offset(segment: Segment, tap: Point): number {
  const nearest = along(segment, Math.min(1, Math.max(0, param(segment, tap))));
  return Math.hypot(tap.x - nearest.x, tap.y - nearest.y) * FIELD;
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
    state.players.includes(player) && !(player in state.results) && // NaN i nieskończoność też tu odpadają: porównanie z NaN jest fałszywe.
    (taps.length === 0 || (taps.length === ROUNDS && taps.every((t, i) => offset(state.segments[i], t) <= ACCEPT_PX))),

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
