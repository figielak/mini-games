import { z } from "zod";
import { byHitsThenAverage, type GameDefinition, type PlayerId, ranked } from "./core.ts";

export const DURATION_MS = 30_000;
const MIN_REACTION_MS = 100;
const MAX_REACTION_MS = 5000;
/** 31 opóźnień po min. 1 s zawsze starcza na 30 s gry. */
const DELAYS = 31;

export type Result = { times: number[]; falseStarts: number };
export type Move = { type: "result" } & Result;

export interface State {
  players: PlayerId[];
  /** Czas od początku czekania do zmiany koloru, ten sam dla wszystkich. */
  delays: number[];
  results: Record<PlayerId, Result>;
}

export type View = State;

// ponytail: wynik liczony na kliencie (opóźnienie Wi-Fi zjadłoby pomiar), da się go podrobić;
// między znajomymi wystarczy, serwer odrzuca tylko nierealne wartości.
export const refleks: GameDefinition<State, Move> = {
  id: "refleks",
  name: "Refleks",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 60,
  moveSchema: z.object({
    type: z.literal("result"),
    times: z.array(z.number()).max(DURATION_MS / MIN_REACTION_MS),
    falseStarts: z.number().int().min(0),
  }),

  setup: (players, rng) => ({
    players,
    delays: Array.from({ length: DELAYS }, () => Math.round(1000 + rng() * 2000)),
    results: {},
  }),

  validateMove: (state, player, { times }) =>
    state.players.includes(player) &&
    !(player in state.results) &&
    times.every((t) => t >= MIN_REACTION_MS && t <= MAX_REACTION_MS) &&
    times.reduce((a, b) => a + b, 0) <= DURATION_MS,

  applyMove: (state, player, { times, falseStarts }) => ({
    ...state,
    results: { ...state.results, [player]: { times, falseStarts } },
  }),

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, byHitsThenAverage),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", times: [], falseStarts: 0 }),
};
