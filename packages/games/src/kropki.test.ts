import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { GAP, kropki as game, MAX, MIN, type Move, ROUNDS, type State } from "./kropki.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy naraz, każdy liczy te same 10 układów kropek (MIN-MAX kropek, pozycje 0-1 z odstępem),
// - odpowiedź to 10 liczb całkowitych 0-99; wynik = suma błędów |odpowiedź − liczba|,
// - mniejsza suma wyżej; pusta odpowiedź (limit czasu) liczy się jak same zera.

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (answers: number[]): Move => ({ type: "result", answers });
const counts = (s: State) => s.rounds.map((r) => r.length);

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje odpowiedzi`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

test("10 rund, liczby w zakresie, kropki w polu i bez nakładania, rewanż ma inne wyzwanie", () => {
  expect(ROUNDS).toBe(10);
  for (let seed = 1; seed <= 20; seed++) {
    const s = game.setup([A, B], createRng(seed));
    expect(s.rounds).toHaveLength(ROUNDS);
    for (const dots of s.rounds) {
      expect(dots.length).toBeGreaterThanOrEqual(MIN);
      expect(dots.length).toBeLessThanOrEqual(MAX);
      for (const [i, d] of dots.entries()) {
        expect(d.x).toBeGreaterThan(0);
        expect(d.x).toBeLessThan(1);
        expect(d.y).toBeGreaterThan(0);
        expect(d.y).toBeLessThan(1);
        for (const e of dots.slice(i + 1)) expect(Math.hypot(d.x - e.x, d.y - e.y)).toBeGreaterThanOrEqual(GAP);
      }
    }
  }
  const s = game.setup([A, B], createRng(1));
  expect(game.waitingFor(s)).toEqual([A, B]);
  expect(game.setup([A, B], createRng(2)).rounds).not.toEqual(s.rounds);
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  const ok = counts(s);
  test.each([
    ["za mało", ok.slice(0, 9)],
    ["za dużo", [...ok, 5]],
    ["ujemne", [...ok.slice(0, 9), -1]],
    ["100", [...ok.slice(0, 9), 100]],
    ["ułamek", [...ok.slice(0, 9), 12.5]],
  ])("%s", (_, answers) => expect(game.validateMove(s, A, result(answers))).toBe(false));
  test("obcy gracz", () => expect(game.validateMove(s, C, result(ok))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(ok)), A, result(ok))).toBe(false));
  test("pusta odpowiedź", () => expect(game.validateMove(s, A, result([]))).toBe(true));
});

describe("koniec", () => {
  test("bezbłędnie = 0, pusta = suma kropek, odpowiedzi zostają w stanie", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(counts(s)));
    s = send(s, B, result([]));
    expect(s.results).toEqual({ [A]: 0, [B]: counts(s).reduce((a, b) => a + b, 0) });
    expect(s.answers[A]).toEqual(counts(s));
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
  });

  test("błędy w obie strony się sumują, mniejsza suma wygrywa", () => {
    let s = game.setup([A, B, C], createRng(1));
    const off = (d: number) => counts(s).map((n, i) => (i % 2 ? n + d : n - d));
    expect(game.isOver(s)).toBeNull();
    s = send(s, A, result(off(3)));
    s = send(s, B, result(off(1)));
    s = send(s, C, result(off(2)));
    expect(s.results).toEqual({ [A]: 30, [B]: 10, [C]: 20 });
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("remis: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(counts(s)));
    s = send(s, B, result(counts(s)));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("po limicie czasu pusta odpowiedź", () => {
    const s = game.setup([A, B], createRng(1));
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual(result([]));
  });
});
