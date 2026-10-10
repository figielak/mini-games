import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { type Move, PENALTY_MS, schulte as game, type State, type View } from "./schulte.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - wszyscy dostają tę samą siatkę 5×5 z liczbami 1-25 w losowej kolejności,
// - klient oddaje czas (ms) i liczbę pomyłek; każda pomyłka to 3 s kary,
// - czas krótszy niż 25 × 150 ms jest nierealny, dłuższy niż limit tury też,
// - ranking po czasie z karami rosnąco; po limicie czasu ostatnie miejsce.

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (ms: number, mistakes = 0): Move => ({ type: "result", ms, mistakes });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

test("siatka to permutacja 1-25, wspólna dla wszystkich", () => {
  const s = game.setup([A, B], createRng(1));
  const { grid } = game.playerView(s, A) as View;
  expect([...grid].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  expect(grid).not.toEqual([...grid].sort((a, b) => a - b));
  expect(game.waitingFor(s)).toEqual([A, B]);
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  test.each([
    ["za szybko", result(3749)],
    ["po limicie tury", result(game.turnSeconds! * 1000 + 1)],
    ["ujemne pomyłki", result(20_000, -1)],
    ["ułamek pomyłki", result(20_000, 0.5)],
  ])("%s", (_, move) => expect(game.validateMove(s, A, move)).toBe(false));
  test("obcy gracz", () => expect(game.validateMove(s, C, result(20_000))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(20_000)), A, result(19_000))).toBe(false));
});

describe("koniec", () => {
  test("pomyłki doliczają karę", () => {
    expect(PENALTY_MS).toBe(3000);
    let s = game.setup([A, B, C], createRng(1));
    s = send(s, A, result(20_000, 2)); // 26 s
    s = send(s, B, result(24_000)); // 24 s
    expect(game.isOver(s)).toBeNull();
    s = send(s, C, result(22_000, 1)); // 25 s
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("kara wyrównuje czas: remis bez zwycięzcy; solo też", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(20_000, 1));
    s = send(s, B, result(23_000));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
    expect(game.isOver(send(game.setup([A], createRng(1)), A, result(20_000)))).toEqual({ ranking: [A] });
  });

  test("granice czasu: najkrótszy i najdłuższy dozwolony", () => {
    const s = game.setup([A, B], createRng(1));
    expect(game.validateMove(s, A, result(3750))).toBe(true);
    expect(game.validateMove(s, A, result(game.turnSeconds! * 1000))).toBe(true);
  });

  test("po limicie czasu ostatnie miejsce", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, game.timeoutMove!(s, A, createRng(1)));
    s = send(s, B, result(game.turnSeconds! * 1000 - 1000));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A] });
  });
});
