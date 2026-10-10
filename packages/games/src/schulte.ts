import { z } from "zod";
import { type GameDefinition, type PlayerId, ranked, shuffle } from "./core.ts";

export const SIZE = 5;
/** Kara za dotknięcie złej liczby. */
export const PENALTY_MS = 3000;
/** Szybciej niż 150 ms na liczbę nikt nie klika. */
const MIN_MS = SIZE * SIZE * 150;

/** `splits`: czasy szukania kolejnych liczb (25 sztuk, suma = `ms`) albo pusta lista po limicie czasu. */
export type Result = { ms: number; mistakes: number; splits: number[] };
export type Move = ({ type: "result" } & Result) | { type: "progress"; found: number };

export interface State {
  players: PlayerId[];
  /** Liczby 1-25 w kolejności pól (wiersz po wierszu), ta sama dla wszystkich. */
  grid: number[];
  results: Record<PlayerId, Result>;
  /** Ile liczb gracz już znalazł (1-24), zgłaszane przez klienta; tylko do podglądu u rywali. */
  progress: Record<PlayerId, number>;
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
  // Stały klucz: ruch progress nie odnawia limitu, nawet gdy gra już tylko jedna osoba.
  turn: () => ({ key: "run", seconds: TURN_SECONDS }),
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("result"), ms: z.number(), mistakes: z.number(), splits: z.array(z.number()).max(SIZE * SIZE) }),
    z.object({ type: z.literal("progress"), found: z.number() }),
  ]),

  setup: (players, rng) => ({
    players,
    grid: shuffle(Array.from({ length: SIZE * SIZE }, (_, i) => i + 1), rng),
    results: {},
    progress: {},
  }),

  validateMove: (state, player, move) =>
    state.players.includes(player) &&
    !(player in state.results) &&
    (move.type === "progress"
      ? Number.isInteger(move.found) && move.found >= 1 && move.found < SIZE * SIZE
      : move.ms >= MIN_MS &&
        move.ms <= TURN_SECONDS * 1000 &&
        Number.isInteger(move.mistakes) &&
        move.mistakes >= 0 &&
        (move.splits.length === 0 ||
          (move.splits.length === SIZE * SIZE &&
            move.splits.every((t) => Number.isInteger(t) && t >= 0) &&
            move.splits.reduce((a, b) => a + b, 0) === move.ms))),

  applyMove: (state, player, move) =>
    move.type === "progress"
      ? { ...state, progress: { ...state.progress, [player]: move.found } }
      : { ...state, results: { ...state.results, [player]: { ms: Math.round(move.ms), mistakes: move.mistakes, splits: move.splits } } },

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, (a, b) => total(a) - total(b)),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", ms: TURN_SECONDS * 1000, mistakes: 0, splits: [] }),
};
