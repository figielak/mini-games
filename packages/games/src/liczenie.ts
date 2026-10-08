import { byHitsThenAverage, type GameDefinition, type PlayerId, type Rng, rankResults, shuffle } from "./core.ts";
import { QUESTIONS, type QuizMove, quizMoveSchema, type QuizResult, validQuiz } from "./quiz.ts";

export { DURATION_MS } from "./quiz.ts";

export type Move = QuizMove;
export type Problem = { text: string; options: number[]; answer: number };

export interface State {
  players: PlayerId[];
  problems: Problem[];
  results: Record<PlayerId, QuizResult>;
}

export type View = State;

const between = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** Proste działanie z czterema odpowiedziami; złe są blisko poprawnej, żeby nie dało się zgadywać na oko. */
export function problem(rng: Rng): Problem {
  let a: number, b: number, op: string, result: number;
  const kind = Math.floor(rng() * 4);
  if (kind === 0) {
    [a, b, op] = [between(rng, 10, 99), between(rng, 10, 99), "+"];
    result = a + b;
  } else if (kind === 1) {
    a = between(rng, 20, 99);
    [b, op] = [between(rng, 10, a), "−"];
    result = a - b;
  } else if (kind === 2) {
    [a, b, op] = [between(rng, 2, 9), between(rng, 2, 12), "×"];
    result = a * b;
  } else {
    [b, result, op] = [between(rng, 2, 9), between(rng, 2, 12), ":"];
    a = b * result;
  }
  const near = [1, -1, 2, -2, 10, -10, ...(op === "×" ? [a, -a, b, -b] : [])].map((d) => result + d);
  const wrong = shuffle([...new Set(near)].filter((n) => n >= 0 && n !== result), rng).slice(0, 3);
  const options = shuffle([result, ...wrong], rng);
  return { text: `${a} ${op} ${b}`, options, answer: options.indexOf(result) };
}

export const liczenie: GameDefinition<State, Move> = {
  id: "liczenie",
  name: "Szybkie liczenie",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 60,
  moveSchema: quizMoveSchema,

  setup: (players, rng) => ({ players, problems: Array.from({ length: QUESTIONS }, () => problem(rng)), results: {} }),

  validateMove: (state, player, move) => validQuiz(state, player, move),

  applyMove: (state, player, { times, errors }) => ({ ...state, results: { ...state.results, [player]: { times, errors } } }),

  playerView: (state): View => state,

  isOver: (state) => rankResults(state.players, state.results, byHitsThenAverage),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", times: [], errors: 0 }),
};
