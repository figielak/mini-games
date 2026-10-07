import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { type Move, refleks as game, type State, type View } from "./refleks.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy grają naraz u siebie, ta sama lista opóźnień (1-3 s) dla wszystkich,
// - klient oddaje jeden wynik: czasy reakcji (100-5000 ms, razem max 30 s) i liczbę falstartów,
// - ranking: więcej trafień wyżej, przy równej liczbie niższa średnia; zwycięzca tylko przy 2+ graczach i bez remisu.

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (times: number[], falseStarts = 0): Move => ({ type: "result", times, falseStarts });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

describe("setup", () => {
  test("wszyscy grają naraz, opóźnienia 1-3 s i wystarczy ich na 30 s", () => {
    const s = game.setup([A, B], createRng(1));
    expect(game.waitingFor(s)).toEqual([A, B]);
    const { delays } = game.playerView(s, A) as View;
    expect(delays.every((d) => d >= 1000 && d <= 3000)).toBe(true);
    expect(delays.reduce((a, b) => a + b, 0)).toBeGreaterThan(30_000);
  });
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  test.each([
    ["za szybka reakcja", [99]],
    ["za wolna reakcja", [5001]],
    ["ponad 30 s razem", Array(11).fill(3000)],
  ])("%s", (_, times) => {
    expect(game.validateMove(s, A, result(times))).toBe(false);
  });
  test("obcy gracz", () => expect(game.validateMove(s, C, result([300]))).toBe(false));
  test("drugi wynik tego samego gracza", () => {
    expect(game.validateMove(send(s, A, result([300])), A, result([200]))).toBe(false);
  });
  test("pusty wynik jest dozwolony", () => expect(game.validateMove(s, A, result([], 3))).toBe(true));
});

describe("koniec", () => {
  test("gra trwa, dopóki ktoś nie oddał wyniku", () => {
    const s = send(game.setup([A, B], createRng(1)), A, result([300]));
    expect(game.waitingFor(s)).toEqual([B]);
    expect(game.isOver(s)).toBeNull();
    expect((game.playerView(s, B) as View).results[A]).toEqual({ times: [300], falseStarts: 0 });
  });

  test("więcej trafień wygrywa, przy remisie niższa średnia", () => {
    let s = game.setup([A, B, C], createRng(1));
    s = send(s, A, result([300, 300]));
    s = send(s, B, result([200, 250, 300]));
    s = send(s, C, result([250, 250]));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("remis na górze: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result([300]));
    s = send(s, B, result([300]));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("solo: bez zwycięzcy", () => {
    const s = send(game.setup([A], createRng(1)), A, result([300]));
    expect(game.isOver(s)).toEqual({ ranking: [A] });
  });

  test("po limicie czasu pusty wynik", () => {
    const s = game.setup([A, B], createRng(1));
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual(result([]));
  });
});
