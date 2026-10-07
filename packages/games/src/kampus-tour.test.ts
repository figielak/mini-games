import { describe, expect, test } from "vitest";
import { createRng, type Rng } from "./core.ts";
import { BOARD, kampusTour as game, ROUNDS, SIZE, type State, type View } from "./kampus-tour.ts";

// Testy napisane przed implementacją. Ustalają zasady szkieletu Kampus Tour:
// - 2-4 graczy, plansza 32 pól, wszyscy startują na polu 0 (Początek dnia),
// - rzut dwiema kośćmi: Math.floor(rng() * 6) + 1 dwa razy, ruch o sumę,
// - przejście przez pole 0 dolicza okrążenie,
// - dublet daje kolejny rzut; trzeci dublet z rzędu: ruch, ale koniec tury,
// - po ROUNDS rundach koniec, ranking wg postępu (okrążenia * 32 + pozycja).

const A = "ania";
const B = "bartek";
const C = "celina";

/** Kostka sterowana w testach: kolejne wywołania dają zadane oczka. */
function dice(...rolls: number[]): Rng {
  let i = 0;
  return () => {
    if (i >= rolls.length) throw new Error("test nie przewidział tylu rzutów");
    return (rolls[i++] - 1) / 6 + 0.001;
  };
}

const view = (s: State) => game.playerView(s, A) as View;

function roll(s: State, player: string, a: number, b: number): State {
  expect(game.validateMove(s, player, { type: "roll" }), `${player} rzuca`).toBe(true);
  return game.applyMove(s, player, { type: "roll" }, dice(a, b));
}

const two = () => game.setup([A, B], createRng(1));

describe("plansza", () => {
  test("32 pola, rogi na 0, 11, 16, 27", () => {
    expect(SIZE).toBe(32);
    expect(BOARD).toHaveLength(32);
    expect(BOARD[0].kind).toBe("start");
    expect(BOARD[11].kind).toBe("kolokwium");
    expect(BOARD[16].kind).toBe("juwenalia");
    expect(BOARD[27].kind).toBe("mpk");
  });

  test("3 pola Karty Dziekanatu, reszta pusta", () => {
    expect(BOARD.filter((t) => t.kind === "karty")).toHaveLength(3);
    expect(BOARD.filter((t) => t.kind === "empty")).toHaveLength(25);
  });
});

describe("setup", () => {
  test.each([2, 3, 4])("%i graczy: wszyscy na starcie, rzuca pierwszy", (n) => {
    const players = [A, B, C, "darek"].slice(0, n);
    const s = game.setup(players, createRng(1));
    const v = view(s);
    for (const p of players) {
      expect(v.positions[p]).toBe(0);
      expect(v.laps[p]).toBe(0);
    }
    expect(game.waitingFor(s)).toEqual([A]);
    expect(v.turn).toBe(A);
    expect(v.round).toBe(1);
    expect(v.dice).toBeNull();
  });

  test("gra dla 2-4 graczy", () => {
    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(4);
  });
});

describe("rzut i ruch", () => {
  test("rzuca tylko gracz na turze", () => {
    expect(game.validateMove(two(), B, { type: "roll" })).toBe(false);
    expect(game.validateMove(two(), "obcy", { type: "roll" })).toBe(false);
  });

  test("ruch o sumę oczek, wynik widać w widoku, tura przechodzi dalej", () => {
    const s = roll(two(), A, 3, 5);
    expect(view(s).positions[A]).toBe(8);
    expect(view(s).dice).toEqual([3, 5]);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("przejście przez start zawija pozycję i dolicza okrążenie", () => {
    const s = roll({ ...two(), positions: { [A]: 29, [B]: 0 } }, A, 2, 4);
    expect(view(s).positions[A]).toBe(3);
    expect(view(s).laps[A]).toBe(1);
  });

  test("dublet daje kolejny rzut", () => {
    const s = roll(two(), A, 2, 2);
    expect(view(s).positions[A]).toBe(4);
    expect(game.waitingFor(s)).toEqual([A]);
  });

  test("trzeci dublet z rzędu: ruch, ale koniec tury", () => {
    let s = roll(two(), A, 1, 1);
    s = roll(s, A, 2, 2);
    s = roll(s, A, 3, 3);
    expect(view(s).positions[A]).toBe(12);
    expect(game.waitingFor(s)).toEqual([B]);
    // Licznik dubletów zeruje się dla kolejnego gracza.
    s = roll(s, B, 1, 1);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("po ostatnim graczu zaczyna się kolejna runda", () => {
    let s = roll(two(), A, 1, 2);
    expect(view(s).round).toBe(1);
    s = roll(s, B, 1, 2);
    expect(view(s).round).toBe(2);
    expect(game.waitingFor(s)).toEqual([A]);
  });

  test("timeoutMove rzuca za gracza", () => {
    expect(game.timeoutMove!(two(), A, createRng(1))).toEqual({ type: "roll" });
  });
});

describe("koniec gry", () => {
  test(`po ${ROUNDS} rundach koniec, ranking wg postępu`, () => {
    let s: State = {
      ...game.setup([A, B, C], createRng(1)),
      round: ROUNDS,
      positions: { [A]: 5, [B]: 20, [C]: 2 },
      laps: { [A]: 1, [B]: 0, [C]: 1 },
    };
    s = roll(s, A, 1, 2); // A: 32 + 8
    s = roll(s, B, 1, 2); // B: 23
    expect(game.isOver(s)).toBeNull();
    s = roll(s, C, 1, 2); // C: 32 + 5
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, C, B] });
    expect(game.waitingFor(s)).toEqual([]);
    expect(view(s).turn).toBeNull();
    expect(game.validateMove(s, A, { type: "roll" })).toBe(false);
  });
});
