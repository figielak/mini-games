import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults } from "./core.ts";

export const COUNT = 5;
/** Tyle ms widać kolor przed odtwarzaniem. */
export const SHOW_MS = 2000;
/** Większy błąd i tak znaczy „zupełnie inny kolor” (czarny i biały to 100). */
const MAX_DISTANCE = 100;

/** Barwa 0-359, nasycenie i jasność 0-100. */
export type Hsb = { h: number; s: number; b: number };

/** Pusta lista = limit czasu (kara jak za same złe kolory). */
export type Move = { type: "result"; guesses: Hsb[] };

export interface State {
  players: PlayerId[];
  targets: Hsb[];
  /** Suma odległości w dziesiątych częściach (int). */
  results: Record<PlayerId, number>;
  guesses: Record<PlayerId, Hsb[]>;
}

export type View = State;

const int = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

export function hsbToRgb({ h, s, b }: Hsb): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return (b / 100) * (1 - (s / 100) * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)].map((c) => Math.round(c * 255)) as [number, number, number];
}

/** sRGB → CIE Lab (D65). */
function lab(c: Hsb) {
  const [r, g, bl] = hsbToRgb(c).map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * bl);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** ΔE (CIE76), ucięta do 100. */
export function distance(a: Hsb, b: Hsb): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.min(MAX_DISTANCE, Math.hypot(l1 - l2, a1 - a2, b1 - b2));
}

const valid = ({ h, s, b }: Hsb) =>
  [h, s, b].every(Number.isInteger) && h >= 0 && h < 360 && s >= 0 && s <= 100 && b >= 0 && b <= 100;

// ponytail: cele są w widoku od startu (jak sekwencja w Simonie), da się podejrzeć; między znajomymi wystarczy.
export const kolor: GameDefinition<State, Move> = {
  id: "kolor",
  name: "Odcień",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 180,
  moveSchema: z.object({
    type: z.literal("result"),
    guesses: z.array(z.object({ h: z.number(), s: z.number(), b: z.number() })).max(COUNT),
  }),

  // Bez prawie szarych i prawie czarnych: przy nich barwa przestaje mieć znaczenie.
  setup: (players, rng) => ({
    players,
    targets: Array.from({ length: COUNT }, () => ({ h: int(rng, 0, 359), s: int(rng, 25, 100), b: int(rng, 30, 100) })),
    results: {},
    guesses: {},
  }),

  validateMove: (state, player, { guesses }) =>
    state.players.includes(player) && !(player in state.results) && (guesses.length === 0 || (guesses.length === COUNT && guesses.every(valid))),

  applyMove: (state, player, { guesses }) => {
    const sum = guesses.length ? state.targets.reduce((s, t, i) => s + distance(t, guesses[i]), 0) : COUNT * MAX_DISTANCE;
    return {
      ...state,
      results: { ...state.results, [player]: Math.round(sum * 10) },
      guesses: { ...state.guesses, [player]: guesses },
    };
  },

  playerView: (state): View => state,

  isOver: (state) => rankResults(state.players, state.results, (a, b) => a - b),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", guesses: [] }),
};
