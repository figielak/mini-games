import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { type Move, simon as game, type State, type View } from "./simon.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy grają naraz u siebie tę samą sekwencję 4 kolorów,
// - klient oddaje najdłuższą powtórzoną serię (0 do długości sekwencji),
// - ranking: dłuższa seria wyżej; zwycięzca tylko przy 2+ graczach i bez remisu.

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (score: number): Move => ({ type: "result", score });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

test("setup: wspólna sekwencja kolorów 0-3, wszyscy grają naraz", () => {
  const s = game.setup([A, B], createRng(1));
  expect(game.waitingFor(s)).toEqual([A, B]);
  const { sequence } = game.playerView(s, A) as View;
  expect(sequence.length).toBeGreaterThanOrEqual(50);
  expect(sequence.every((c) => [0, 1, 2, 3].includes(c))).toBe(true);
  expect((game.playerView(s, B) as View).sequence).toEqual(sequence);
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  const length = (game.playerView(s, A) as View).sequence.length;
  test("wynik poza zakresem", () => {
    expect(game.validateMove(s, A, result(-1))).toBe(false);
    expect(game.validateMove(s, A, result(length + 1))).toBe(false);
    expect(game.validateMove(s, A, result(length))).toBe(true);
  });
  test("obcy gracz", () => expect(game.validateMove(s, C, result(3))).toBe(false));
  test("drugi wynik tego samego gracza", () => {
    expect(game.validateMove(send(s, A, result(3)), A, result(5))).toBe(false);
  });
});

describe("koniec", () => {
  test("ranking po długości serii", () => {
    let s = game.setup([A, B, C], createRng(1));
    s = send(s, A, result(4));
    expect(game.isOver(s)).toBeNull();
    expect(game.waitingFor(s)).toEqual([B, C]);
    s = send(s, B, result(9));
    s = send(s, C, result(6));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("remis na górze i solo: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(5));
    s = send(s, B, result(5));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
    expect(game.isOver(send(game.setup([A], createRng(1)), A, result(5)))).toEqual({ ranking: [A] });
  });

  test("po limicie czasu wynik 0", () => {
    expect(game.timeoutMove!(game.setup([A], createRng(1)), A, createRng(1))).toEqual(result(0));
  });
});
