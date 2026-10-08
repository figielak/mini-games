import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { COLORS, DURATION_MS, type Move, type State, stroop as game, type View } from "./stroop.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - wszyscy dostają te same plansze: słowo (nazwa koloru) napisane innym kolorem (ink), odpowiedź = ink,
// - plansz wystarczy na 30 s, większość jest niezgodna (słowo ≠ kolor),
// - klient oddaje czasy trafień (150-5000 ms, razem max 30 s) i liczbę pomyłek,
// - ranking: więcej trafień wyżej, remis rozstrzyga niższa średnia.

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (times: number[], errors = 0): Move => ({ type: "result", times, errors });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

test("plansze: 4 kolory, wystarczy na 30 s, większość niezgodna", () => {
  expect(COLORS).toHaveLength(4);
  const { trials } = game.playerView(game.setup([A, B], createRng(1)), A) as View;
  expect(trials.length * 150).toBeGreaterThanOrEqual(DURATION_MS);
  expect(trials.every((t) => [t.word, t.ink].every((c) => Number.isInteger(c) && c >= 0 && c < 4))).toBe(true);
  expect(trials.filter((t) => t.word !== t.ink).length / trials.length).toBeGreaterThan(0.6);
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  test.each([
    ["za szybko", result([149])],
    ["za wolno", result([5001])],
    ["ponad 30 s", result(Array(11).fill(3000))],
    ["ujemne pomyłki", result([500], -1)],
  ])("%s", (_, move) => expect(game.validateMove(s, A, move)).toBe(false));
  test("obcy gracz", () => expect(game.validateMove(s, C, result([500]))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result([500])), A, result([400]))).toBe(false));
  test("pusty wynik", () => expect(game.validateMove(s, A, result([], 4))).toBe(true));
});

describe("koniec", () => {
  test("więcej trafień wygrywa, remis rozstrzyga średnia", () => {
    let s = game.setup([A, B, C], createRng(1));
    s = send(s, A, result([600, 600]));
    s = send(s, B, result([700, 700, 700], 5));
    expect(game.isOver(s)).toBeNull();
    s = send(s, C, result([500, 500]));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("po limicie czasu pusty wynik", () => {
    expect(game.timeoutMove!(game.setup([A], createRng(1)), A, createRng(1))).toEqual(result([]));
  });
});
