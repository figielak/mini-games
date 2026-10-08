import { z } from "zod";
import type { PlayerId } from "./core.ts";

// Wspólne zasady gier „30 s pytań z czterema odpowiedziami” (Stroop, Szybkie liczenie).

export const DURATION_MS = 30_000;
const MIN_ANSWER_MS = 150;
const MAX_ANSWER_MS = 5000;
/** Tyle pytań starcza nawet przy samych odpowiedziach po 150 ms. */
export const QUESTIONS = DURATION_MS / MIN_ANSWER_MS;

/** Czasy poprawnych odpowiedzi i liczba pomyłek. */
export type QuizResult = { times: number[]; errors: number };
export type QuizMove = { type: "result" } & QuizResult;

export const quizMoveSchema = z.object({
  type: z.literal("result"),
  times: z.array(z.number()).max(QUESTIONS),
  errors: z.number().int().min(0),
});

// ponytail: wynik liczony na kliencie jak w Refleksie, serwer odrzuca tylko nierealne wartości.
export const validQuiz = (state: { players: PlayerId[]; results: Record<PlayerId, unknown> }, player: PlayerId, { times, errors }: QuizResult) =>
  state.players.includes(player) &&
  !(player in state.results) &&
  Number.isInteger(errors) &&
  errors >= 0 &&
  times.every((t) => t >= MIN_ANSWER_MS && t <= MAX_ANSWER_MS) &&
  times.reduce((a, b) => a + b, 0) <= DURATION_MS;
