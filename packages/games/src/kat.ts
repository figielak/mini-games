import { z } from "zod";
import { type GameDefinition, type PlayerId, ranked } from "./core.ts";

export const ROUNDS = 10;
/** Zakres losowanych kątów w stopniach: bez wklęsłych, więc nie trzeba oznaczać mierzonej strony. */
export const MIN = 5;
export const MAX = 175;
/** Największa odpowiedź, jaką przyjmuje serwer. */
export const MAX_ANSWER = 180;
/** Tyle ms widać kąt. */
export const SHOW_MS = 1500;

/** Całe stopnie. `rotation` to kierunek pierwszego ramienia, drugie leży pod `rotation + angle`. */
export type Round = { angle: number; rotation: number };

/** Pusta lista = limit czasu (w każdej rundzie najgorszy możliwy błąd). */
export type Move = { type: "result"; answers: number[] } | { type: "progress"; done: number };

export interface State {
  players: PlayerId[];
  rounds: Round[];
  /** Suma błędów w stopniach. */
  results: Record<PlayerId, number>;
  answers: Record<PlayerId, number[]>;
  /** Ile rund gracz już odpowiedział (1-9), zgłaszane przez klienta; tylko do podglądu u rywali. */
  progress: Record<PlayerId, number>;
}

export type View = State;

const TURN_SECONDS = 120;

const int = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const worst = (angle: number) => Math.max(angle, MAX_ANSWER - angle);

// ponytail: kąty są w widoku od startu (jak kropki w Policz kropki), da się podejrzeć; między znajomymi wystarczy.
// ponytail: szkielet zasad to trzecia kopia (kropki, rok, kat); wspólny moduł, gdy dojdzie czwarta albo zmieni się kształt ruchu.
export const kat: GameDefinition<State, Move> = {
  id: "kat",
  name: "Kąt",
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
    rounds: Array.from({ length: ROUNDS }, () => ({ angle: int(rng, MIN, MAX), rotation: int(rng, 0, 359) })),
    results: {},
    answers: {},
    progress: {},
  }),

  validateMove: (state, player, move) =>
    state.players.includes(player) &&
    !(player in state.results) &&
    (move.type === "progress"
      ? Number.isInteger(move.done) && move.done >= 1 && move.done < ROUNDS
      : move.answers.length === 0 || (move.answers.length === ROUNDS && move.answers.every((a) => Number.isInteger(a) && a >= 0 && a <= MAX_ANSWER))),

  applyMove: (state, player, move) =>
    move.type === "progress"
      ? { ...state, progress: { ...state.progress, [player]: move.done } }
      : {
          ...state,
          results: {
            ...state.results,
            [player]: state.rounds.reduce((s, r, i) => s + (move.answers.length ? Math.abs(move.answers[i] - r.angle) : worst(r.angle)), 0),
          },
          answers: { ...state.answers, [player]: move.answers },
        },

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, (a, b) => a - b),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", answers: [] }),
};
