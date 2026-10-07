import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults } from "./core.ts";

/** Dłuższej serii nikt nie powtórzy na wykładzie. */
const LENGTH = 100;

export type Move = { type: "result"; score: number };

export interface State {
  players: PlayerId[];
  /** Kolory 0-3, ta sama sekwencja dla wszystkich. */
  sequence: number[];
  /** Najdłuższa powtórzona seria. */
  results: Record<PlayerId, number>;
}

export type View = State;

// ponytail: wynik liczony na kliencie (sekwencja i tak jest w widoku), serwer sprawdza tylko zakres.
export const simon: GameDefinition<State, Move> = {
  id: "simon",
  name: "Simon",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 300,
  moveSchema: z.object({ type: z.literal("result"), score: z.number().int() }),

  setup: (players, rng) => ({
    players,
    sequence: Array.from({ length: LENGTH }, () => Math.floor(rng() * 4)),
    results: {},
  }),

  validateMove: (state, player, { score }) =>
    state.players.includes(player) && !(player in state.results) && score >= 0 && score <= state.sequence.length,

  applyMove: (state, player, { score }) => ({ ...state, results: { ...state.results, [player]: score } }),

  playerView: (state): View => state,

  isOver: (state) => rankResults(state.players, state.results, (a, b) => b - a),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", score: 0 }),
};
