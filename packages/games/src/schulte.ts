import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults, shuffle } from "./core.ts";

export const SIZE = 5;
/** Kara za dotknięcie złej liczby. */
export const PENALTY_MS = 3000;
/** Szybciej niż 150 ms na liczbę nikt nie klika. */
const MIN_MS = SIZE * SIZE * 150;

export type Result = { ms: number; mistakes: number };
export type Move = { type: "result" } & Result;

export interface State {
  players: PlayerId[];
  /** Liczby 1-25 w kolejności pól (wiersz po wierszu), ta sama dla wszystkich. */
  grid: number[];
  results: Record<PlayerId, Result>;
}

export type View = State;

export const total = (r: Result) => r.ms + r.mistakes * PENALTY_MS;

const TURN_SECONDS = 180;

// ponytail: czas mierzony na kliencie, serwer odrzuca tylko nierealne wartości.
export const schulte: GameDefinition<State, Move> = {
  id: "schulte",
  name: "Tabela Schultego",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: TURN_SECONDS,
  moveSchema: z.object({ type: z.literal("result"), ms: z.number(), mistakes: z.number() }),

  setup: (players, rng) => ({
    players,
    grid: shuffle(Array.from({ length: SIZE * SIZE }, (_, i) => i + 1), rng),
    results: {},
  }),

  validateMove: (state, player, { ms, mistakes }) =>
    state.players.includes(player) &&
    !(player in state.results) &&
    ms >= MIN_MS &&
    ms <= TURN_SECONDS * 1000 &&
    Number.isInteger(mistakes) &&
    mistakes >= 0,

  applyMove: (state, player, { ms, mistakes }) => ({ ...state, results: { ...state.results, [player]: { ms: Math.round(ms), mistakes } } }),

  playerView: (state): View => state,

  isOver: (state) => rankResults(state.players, state.results, (a, b) => total(a) - total(b)),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", ms: TURN_SECONDS * 1000, mistakes: 0 }),
};
