import { z } from "zod";
import { type GameDefinition, type PlayerId, ranked } from "./core.ts";

/** Po tylu ms licznik znika i gracz liczy w głowie. */
export const VISIBLE_MS = 3000;

/** Odchyłka od celu w ms; brak dotknięcia liczy się jak najgorszy wynik. */
export type Move = { type: "result"; deviation: number };

export interface State {
  players: PlayerId[];
  /** Cel w ms: pełne sekundy 6-14 s, ten sam dla wszystkich. */
  target: number;
  /** Nic nie losuje, tylko odróżnia partie (rewanż montuje grę na kliencie od nowa). */
  nonce: number;
  results: Record<PlayerId, number>;
}

export type View = State;

// ponytail: pomiar na kliencie, da się podrobić; między znajomymi wystarczy.
export const stoper: GameDefinition<State, Move> = {
  id: "stoper",
  name: "Stoper",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 60,
  moveSchema: z.object({ type: z.literal("result"), deviation: z.number() }),

  setup: (players, rng) => ({ players, target: 6000 + Math.floor(rng() * 9) * 1000, nonce: Math.floor(rng() * 2 ** 32), results: {} }),

  validateMove: (state, player, { deviation }) =>
    state.players.includes(player) && !(player in state.results) && Number.isInteger(deviation) && deviation >= 0 && deviation <= state.target,

  applyMove: (state, player, { deviation }) => ({ ...state, results: { ...state.results, [player]: deviation } }),

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, (a, b) => a - b),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: (state) => ({ type: "result", deviation: state.target }),
};
