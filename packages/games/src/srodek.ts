import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults } from "./core.ts";

export const ROUNDS = 10;
/** Bok pola w umownych px (do strefy akceptacji): nie zależy od rozmiaru telefonu. */
export const FIELD = 300;
/** Kara za rundę po limicie czasu, w % długości odcinka; więcej niż najgorsza uczciwa runda (koniec odcinka = 50% plus strefa). */
export const MAX_ERROR = 100;
/** Strefa akceptacji w umownych px (dotyczy palca, nie oka): dotknięcie dalej od odcinka nie jest odpowiedzią (przypadkowe stuknięcie, próba nadużycia rzutowania). */
export const ACCEPT_PX = 30;
/**
 * Długość odcinka i odstęp końców od krawędzi, w ułamkach boku pola. Długie, bo niedokładność palca jest stała,
 * a pomyłka oka rośnie z długością: na krótkim odcinku gra mierzyłaby palec.
 */
export const MIN_LEN = 0.5;
export const MAX_LEN = 0.9;
export const MARGIN = 0.05;

/** Pozycja na polu, 0-1 w obu osiach. */
export type Point = { x: number; y: number };
export type Segment = { a: Point; b: Point };

/** Pusta lista = limit czasu (MAX_ERROR za każdą rundę). */
export type Move = { type: "result"; taps: Point[] };

export interface State {
  players: PlayerId[];
  segments: Segment[];
  /** Suma błędów w dziesiątych częściach procenta (int). */
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

/**
 * Błąd rundy w % długości odcinka: odległość rzutu od środka, wzdłuż odcinka (koniec = 50). Odchylenie w bok nic nie kosztuje,
 * a każda runda waży tyle samo niezależnie od długości.
 */
export const error = (segment: Segment, tap: Point): number => Math.abs(param(segment, tap) - 0.5) * 100;

/** Odległość dotknięcia od najbliższego punktu odcinka w umownych px (do strefy akceptacji). */
export function offset(segment: Segment, tap: Point): number {
  const nearest = along(segment, Math.min(1, Math.max(0, param(segment, tap))));
  return Math.hypot(tap.x - nearest.x, tap.y - nearest.y) * FIELD;
}

// Najpierw kąt i długość, potem środek tam, gdzie oba końce mieszczą się w marginesie: każdy kąt i długość są równie częste
// (losowanie z odrzucaniem przy długich odcinkach zostawiałoby prawie same przekątne).
function segment(rng: () => number): Segment {
  const angle = rng() * Math.PI;
  const half = (MIN_LEN + rng() * (MAX_LEN - MIN_LEN)) / 2;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  const center = (reach: number) => MARGIN + reach + rng() * (1 - 2 * MARGIN - 2 * reach);
  const x = center(Math.abs(dx));
  const y = center(dy);
  return { a: { x: x - dx, y: y - dy }, b: { x: x + dx, y: y + dy } };
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
    const sum = taps.length ? state.segments.reduce((s, seg, i) => s + error(seg, taps[i]), 0) : ROUNDS * MAX_ERROR;
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
