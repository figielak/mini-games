import { z } from "zod";
import { type GameDefinition, type PlayerId, ranked } from "./core.ts";

export const LEVELS = 30;
/** Pole ma szerokość 1; podstawa leży na środku. */
export const START_WIDTH = 0.4;
/** Odchyłka do tej wartości to trafienie idealne: klocek wyrównuje się i nic nie jest ucinane. */
export const SNAP = 0.02;
/** Węższa część wspólna to pudło. */
export const MIN_WIDTH = 0.02;
export const SPEED_START = 0.5;
export const SPEED_STEP = 0.03;
/** Niedotknięty klocek spada sam. */
export const MAX_STOP_MS = 5000;

export type Block = { left: number; width: number };
/** Wysokość wieży i szerokość ostatniego położonego klocka. */
export type Result = { height: number; width: number };
/** `stops[i]` to czas zatrzymania klocka `i` w ms od jego startu. */
export type Move = { type: "result"; stops: number[] } | { type: "progress"; height: number };

export interface State {
  players: PlayerId[];
  /** Z której strony startuje klocek na każdym piętrze (true = z lewej), to samo dla wszystkich. */
  sides: boolean[];
  results: Record<PlayerId, Result>;
  /** Wysokość wieży w trakcie partii (1-29), zgłaszana przez klienta; tylko do podglądu u rywali. */
  progress: Record<PlayerId, number>;
}

export type View = State;

const TURN_SECONDS = 180;

export const BASE: Block = { left: (1 - START_WIDTH) / 2, width: START_WIDTH };

/** Lewa krawędź jadącego klocka: fala trójkątna w `[0, 1 − width]`, ten sam wzór na serwerze i w ekranie. */
export function left(fromLeft: boolean, level: number, width: number, t: number): number {
  const span = 1 - width;
  const distance = ((SPEED_START + level * SPEED_STEP) * Math.min(MAX_STOP_MS, Math.max(0, t))) / 1000;
  const wrapped = distance % (2 * span);
  const x = wrapped < span ? wrapped : 2 * span - wrapped;
  return fromLeft ? x : span - x;
}

/** Wieża z czasów zatrzymania kolejnych klocków; pierwsze pudło kończy liczenie. */
export function build(sides: boolean[], stops: number[]): { blocks: Block[] } & Result {
  const blocks: Block[] = [];
  let prev = BASE;
  for (const [level, t] of stops.slice(0, LEVELS).entries()) {
    const x = left(sides[level], level, prev.width, t);
    const off = Math.abs(x - prev.left);
    if (off > SNAP) {
      const width = prev.width - off;
      if (width < MIN_WIDTH) break;
      prev = { left: Math.max(x, prev.left), width };
    }
    blocks.push(prev);
  }
  return { blocks, height: blocks.length, width: prev.width };
}

// ponytail: czasy mierzy klient (opóźnienie Wi-Fi zjadłoby pomiar) i zna wzór, więc idealne czasy da się policzyć;
// serwer sam liczy z nich wieżę i odrzuca czasy spoza zakresu.
export const wieza: GameDefinition<State, Move> = {
  id: "wieza",
  name: "Wieża",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: TURN_SECONDS,
  // Stały klucz: ruch progress nie odnawia limitu, nawet gdy gra już tylko jedna osoba.
  turn: () => ({ key: "run", seconds: TURN_SECONDS }),
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("result"), stops: z.array(z.number().int()).max(LEVELS) }),
    z.object({ type: z.literal("progress"), height: z.number().int() }),
  ]),

  setup: (players, rng) => ({
    players,
    sides: Array.from({ length: LEVELS }, () => rng() < 0.5),
    results: {},
    progress: {},
  }),

  validateMove: (state, player, move) =>
    state.players.includes(player) &&
    !(player in state.results) &&
    (move.type === "progress" ? move.height >= 1 && move.height < LEVELS : move.stops.length <= LEVELS && move.stops.every((t) => t >= 0 && t <= MAX_STOP_MS)),

  applyMove: (state, player, move) => {
    if (move.type === "progress") return { ...state, progress: { ...state.progress, [player]: move.height } };
    const { height, width } = build(state.sides, move.stops);
    return { ...state, results: { ...state.results, [player]: { height, width } } };
  },

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, (a, b) => b.height - a.height || b.width - a.width),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", stops: [] }),
};
