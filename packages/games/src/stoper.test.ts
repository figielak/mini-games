import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { type Move, type State, stoper as game, TARGET_MS } from "./stoper.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy naraz, każdy zatrzymuje stoper u siebie, oddaje odchyłkę od 10 s w ms (0-10000),
// - mniejsza odchyłka wyżej; zwycięzca tylko przy 2+ graczach i bez remisu,
// - po limicie czasu najgorszy wynik (10000).

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (deviation: number): Move => ({ type: "result", deviation });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

test("cel to 10 s, wszyscy grają naraz, rewanż ma inne wyzwanie", () => {
  expect(TARGET_MS).toBe(10_000);
  const s = game.setup([A, B], createRng(1));
  expect(game.waitingFor(s)).toEqual([A, B]);
  expect(game.setup([A, B], createRng(2)).nonce).not.toBe(s.nonce);
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  test.each([[-1], [10_001], [1.5]])("odchyłka %s", (d) => expect(game.validateMove(s, A, result(d))).toBe(false));
  test("obcy gracz", () => expect(game.validateMove(s, C, result(10))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(10)), A, result(5))).toBe(false));
  test("trafienie w punkt", () => expect(game.validateMove(s, A, result(0))).toBe(true));
});

describe("koniec", () => {
  test("mniejsza odchyłka wygrywa", () => {
    let s = game.setup([A, B, C], createRng(1));
    expect(game.isOver(s)).toBeNull();
    s = send(s, A, result(300));
    s = send(s, B, result(15));
    s = send(s, C, result(120));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("remis: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(40));
    s = send(s, B, result(40));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("po limicie czasu najgorszy wynik", () => {
    const s = game.setup([A, B], createRng(1));
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual(result(TARGET_MS));
  });
});
