import { z } from "zod";
import { type GameDefinition, type PlayerId, ranked } from "./core.ts";

export const ROUNDS = 10;
export const MIN = 8;
export const MAX = 40;
/** Tyle ms widać kropki. */
export const SHOW_MS = 1500;
/** Minimalna odległość środków kropek (pole 0-1), żeby się nie nakładały. */
export const GAP = 0.08;
const MARGIN = 0.05;

export type Dot = { x: number; y: number };

/** Pusta lista = limit czasu (liczona jak same zera). */
export type Move = { type: "result"; answers: number[] } | { type: "progress"; done: number };

export interface State {
  players: PlayerId[];
  rounds: Dot[][];
  /** Suma błędów. */
  results: Record<PlayerId, number>;
  answers: Record<PlayerId, number[]>;
  /** Ile rund gracz już odpowiedział (1-9), zgłaszane przez klienta; tylko do podglądu u rywali. */
  progress: Record<PlayerId, number>;
}

export type View = State;

const TURN_SECONDS = 120;

const int = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

// Przy 40 kropkach zajęte jest ~25% pola, losowanie z odrzucaniem kończy się szybko.
function scatter(rng: () => number, count: number): Dot[] {
  const dots: Dot[] = [];
  while (dots.length < count) {
    const d = { x: MARGIN + rng() * (1 - 2 * MARGIN), y: MARGIN + rng() * (1 - 2 * MARGIN) };
    if (dots.every((e) => Math.hypot(d.x - e.x, d.y - e.y) >= GAP)) dots.push(d);
  }
  return dots;
}

// ponytail: kropki są w widoku od startu (jak cele w Kolorze), da się podejrzeć; między znajomymi wystarczy.
export const kropki: GameDefinition<State, Move> = {
  id: "kropki",
  name: "Policz kropki",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: TURN_SECONDS,
  // Stały klucz: ruch progress nie odnawia limitu, nawet gdy gra już tylko jedna osoba.
  turn: () => ({ key: "run", seconds: TURN_SECONDS }),
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("result"), answers: z.array(z.number()).max(ROUNDS) }),
    z.object({ type: z.literal("progress"), done: z.number() }),
  ]),

  setup: (players, rng) => ({
    players,
    rounds: Array.from({ length: ROUNDS }, () => scatter(rng, int(rng, MIN, MAX))),
    results: {},
    answers: {},
    progress: {},
  }),

  validateMove: (state, player, move) =>
    state.players.includes(player) &&
    !(player in state.results) &&
    (move.type === "progress"
      ? Number.isInteger(move.done) && move.done >= 1 && move.done < ROUNDS
      : move.answers.length === 0 || (move.answers.length === ROUNDS && move.answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 99))),

  applyMove: (state, player, move) =>
    move.type === "progress"
      ? { ...state, progress: { ...state.progress, [player]: move.done } }
      : {
          ...state,
          results: { ...state.results, [player]: state.rounds.reduce((s, dots, i) => s + Math.abs((move.answers[i] ?? 0) - dots.length), 0) },
          answers: { ...state.answers, [player]: move.answers },
        },

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, (a, b) => a - b),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", answers: [] }),
};
