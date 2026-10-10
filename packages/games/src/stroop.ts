import { byHitsThenAverage, type GameDefinition, type PlayerId, rankResults } from "./core.ts";
import { QUESTIONS, type QuizMove, quizMoveSchema, type QuizResult, validQuiz } from "./quiz.ts";

export { DURATION_MS } from "./quiz.ts";

/** Nazwy kolorów; klient trzyma odcienie w tej samej kolejności. */
export const COLORS = ["CZERWONY", "NIEBIESKI", "ŻÓŁTY", "ZIELONY"] as const;
/** Odsetek plansz, na których słowo zgadza się z kolorem (żeby nie dało się grać „zawsze inny”). */
const SAME = 0.25;

export type Move = QuizMove;

export interface State {
  players: PlayerId[];
  /** Słowo i kolor liter (indeksy COLORS); odpowiedź to kolor liter. */
  trials: { word: number; ink: number }[];
  results: Record<PlayerId, QuizResult>;
}

export type View = State;

export const stroop: GameDefinition<State, Move> = {
  id: "stroop",
  name: "Kolor liter",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 60,
  moveSchema: quizMoveSchema,

  setup: (players, rng) => ({
    players,
    trials: Array.from({ length: QUESTIONS }, () => {
      const ink = Math.floor(rng() * 4);
      const word = rng() < SAME ? ink : (ink + 1 + Math.floor(rng() * 3)) % 4;
      return { word, ink };
    }),
    results: {},
  }),

  validateMove: (state, player, move) => validQuiz(state, player, move),

  applyMove: (state, player, { times, errors }) => ({ ...state, results: { ...state.results, [player]: { times, errors } } }),

  playerView: (state): View => state,

  isOver: (state) => rankResults(state.players, state.results, byHitsThenAverage),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", times: [], errors: 0 }),
};
