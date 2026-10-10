import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { DURATION_MS, liczenie as game, type Move, type State, type View } from "./liczenie.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - wszyscy dostają te same działania (+, −, ×, :) z czterema różnymi, nieujemnymi odpowiedziami, jedna poprawna,
// - działań wystarczy na 30 s,
// - wynik i ranking jak w Stroopie: czasy trafień (150-5000 ms, razem max 30 s), pomyłki, remis rozstrzyga średnia.

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (times: number[], errors = 0): Move => ({ type: "result", times, errors });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

/** Liczy działanie z tekstu, żeby sprawdzić poprawną odpowiedź niezależnie od generatora. */
function evaluate(text: string): number {
  const [a, op, b] = text.split(" ");
  const x = Number(a);
  const y = Number(b);
  return op === "+" ? x + y : op === "−" ? x - y : op === "×" ? x * y : x / y;
}

test("działania: poprawna odpowiedź, 4 różne nieujemne opcje, wszystkie rodzaje", () => {
  const { problems } = game.playerView(game.setup([A, B], createRng(1)), A) as View;
  expect(problems.length * 150).toBeGreaterThanOrEqual(DURATION_MS);
  for (const p of problems) {
    expect(p.options[p.answer], p.text).toBe(evaluate(p.text));
    expect(new Set(p.options).size).toBe(4);
    expect(p.options.every((o) => Number.isInteger(o) && o >= 0)).toBe(true);
  }
  expect(new Set(problems.map((p) => p.text.split(" ")[1]))).toEqual(new Set(["+", "−", "×", ":"]));
  expect(new Set(problems.map((p) => p.answer)).size).toBe(4);
});

test("złe odpowiedzi: blisko poprawnej, a liczby z działania nie ma wśród opcji", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const { problems } = game.setup([A], createRng(seed));
    for (const p of problems) {
      const [a, op, b] = p.text.split(" ");
      const correct = p.options[p.answer];
      const wrong = p.options.filter((o) => o !== correct);
      expect(new Set(p.options).size, p.text).toBe(4);
      // Wynik widoczny w zadaniu (49 : 7 = 7) dałoby się wskazać bez liczenia, a zły taki sam od razu odrzucić.
      expect(p.options, p.text).not.toContain(Number(a));
      expect(p.options, p.text).not.toContain(Number(b));
      expect(wrong.every((o) => o > 0), p.text).toBe(true);
      // Przy dzieleniu wyniki to 2-12, więc „+10” (17 zamiast 7) odpada na oko: tylko sąsiedzi.
      const reach = op === ":" ? 3 : op === "×" ? 12 : 20;
      expect(Math.max(...wrong.map((o) => Math.abs(o - correct))), p.text).toBeLessThanOrEqual(reach);
    }
  }
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  test.each([
    ["za szybko", result([149])],
    ["ponad 30 s", result(Array(11).fill(3000))],
    ["ujemne pomyłki", result([500], -1)],
  ])("%s", (_, move) => expect(game.validateMove(s, A, move)).toBe(false));
  test("obcy gracz", () => expect(game.validateMove(s, C, result([500]))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result([500])), A, result([400]))).toBe(false));
});

test("ranking: więcej poprawnych wyżej, remis rozstrzyga średnia", () => {
  let s = game.setup([A, B, C], createRng(1));
  s = send(s, A, result([1500, 1500]));
  s = send(s, B, result([2000, 2000, 2000]));
  s = send(s, C, result([1000, 1000]));
  expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
});

describe("koniec", () => {
  test("gra trwa, dopóki ktoś nie oddał wyniku", () => {
    const s = send(game.setup([A, B], createRng(1)), A, result([500]));
    expect(game.isOver(s)).toBeNull();
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("remis na górze i solo: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result([1000, 2000]));
    s = send(s, B, result([1500, 1500], 4));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
    expect(game.isOver(send(game.setup([A], createRng(1)), A, result([500])))).toEqual({ ranking: [A] });
  });

  test("po limicie czasu pusty wynik; dwa limity to remis", () => {
    let s = game.setup([A, B], createRng(1));
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual(result([]));
    for (const p of [A, B]) s = send(s, p, game.timeoutMove!(s, p, createRng(1)));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
    expect(game.waitingFor(s)).toEqual([]);
  });
});
