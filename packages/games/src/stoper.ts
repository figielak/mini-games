import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults } from "./core.ts";

export const TARGET_MS = 10_000;
/** Po tylu ms licznik znika i gracz liczy w głowie. */
export const VISIBLE_MS = 3000;

/** Odchyłka od 10 s w ms; brak dotknięcia liczy się jak najgorszy wynik. */
export type Move = { type: "result"; deviation: number };

export interface State {
  players: PlayerId[];
  /** Nic nie losuje, tylko odróżnia partie (rewanż montuje grę na kliencie od nowa). */
  nonce: number;
  results: Record<PlayerId, number>;
}

export type View = State;

// ponytail: pomiar na kliencie, da się podrobić; między znajomymi wystarczy.
export const stoper: GameDefinition<State, Move> = {
  id: "stoper",
  name: "Stoper 10 s",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 60,
  moveSchema: z.object({ type: z.literal("result"), deviation: z.number() }),

  setup: (players, rng) => ({ players, nonce: Math.floor(rng() * 2 ** 32), results: {} }),

  validateMove: (state, player, { deviation }) =>
    state.players.includes(player) && !(player in state.results) && Number.isInteger(deviation) && deviation >= 0 && deviation <= TARGET_MS,

  applyMove: (state, player, { deviation }) => ({ ...state, results: { ...state.results, [player]: deviation } }),

  playerView: (state): View => state,

  isOver: (state) => rankResults(state.players, state.results, (a, b) => a - b),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", deviation: TARGET_MS }),
};
