import { describe, expect, test } from "vitest";
import { createRng, type Rng } from "./core.ts";
import { ALLOWANCE, BOARD, kampusTour as game, type Move, ROUNDS, SIZE, START_CASH, type State, type View } from "./kampus-tour.ts";

// Testy napisane przed implementacją. Ustalają zasady Kampus Tour:
// - 2-4 graczy, plansza 32 pól, wszyscy startują na polu 0 (Początek dnia) z 200 zł,
// - rzut dwiema kośćmi: Math.floor(rng() * 6) + 1 dwa razy, ruch o sumę,
// - przejście przez pole 0 dolicza okrążenie i 20 zł kieszonkowego,
// - wolne pole można kupić (jeśli stać) albo pominąć; na cudzym płaci się czynsz P/10, za całą grupę ×2,
// - pole 28 (Opłata za akademik) kosztuje 15 zł,
// - brak gotówki: sprzedaż pól bankowi za połowę ceny, a gdy to nie wystarczy, bankructwo,
// - dublet daje kolejny rzut; trzeci dublet z rzędu: ruch, ale koniec tury,
// - koniec, gdy zostanie jeden gracz albo po ROUNDS rundach (ranking wg majątku: gotówka + ceny pól).

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

function play(s: State, player: string, move: Move, rng: Rng = dice()): State {
  expect(game.validateMove(s, player, move), `${player}: ${JSON.stringify(move)}`).toBe(true);
  return game.applyMove(s, player, move, rng);
}

const roll = (s: State, player: string, a: number, b: number) => play(s, player, { type: "roll" }, dice(a, b));

const two = () => game.setup([A, B], createRng(1));
const three = () => game.setup([A, B, C], createRng(1));

/** Stan z nadpisaną gotówką, właścicielami i pozycjami. */
function with2(s: State, patch: Partial<Pick<State, "cash" | "owners" | "positions" | "round">>): State {
  return {
    ...s,
    cash: { ...s.cash, ...patch.cash },
    owners: { ...s.owners, ...patch.owners },
    positions: { ...s.positions, ...patch.positions },
    round: patch.round ?? s.round,
  };
}

const price = (tile: number) => {
  const t = BOARD[tile];
  if (t.kind !== "property") throw new Error(`pole ${tile} nie jest do kupienia`);
  return t.price;
};

describe("plansza", () => {
  test("32 pola, rogi na 0, 11, 16, 27", () => {
    expect(SIZE).toBe(32);
    expect(BOARD).toHaveLength(32);
    expect(BOARD[0].kind).toBe("start");
    expect(BOARD[11].kind).toBe("kolokwium");
    expect(BOARD[16].kind).toBe("juwenalia");
    expect(BOARD[27].kind).toBe("mpk");
  });

  test("3 pola Karty Dziekanatu i Opłata za akademik na 28", () => {
    expect([5, 13, 21].map((i) => BOARD[i].kind)).toEqual(["karty", "karty", "karty"]);
    expect(BOARD[28]).toEqual({ kind: "tax", amount: 15 });
  });

  test("8 grup po 3 pola z cenami rosnącymi wzdłuż planszy", () => {
    const groups = [
      [[1, 2, 3], 10],
      [[4, 6, 7], 15],
      [[8, 9, 10], 20],
      [[12, 14, 15], 25],
      [[17, 18, 19], 30],
      [[20, 22, 23], 35],
      [[24, 25, 26], 40],
      [[29, 30, 31], 50],
    ] as const;
    groups.forEach(([tiles, p], group) => {
      for (const i of tiles) expect(BOARD[i], `pole ${i}`).toEqual({ kind: "property", group, price: p });
    });
    expect(BOARD.filter((t) => t.kind === "property")).toHaveLength(24);
  });
});

describe("setup", () => {
  test.each([2, 3, 4])("%i graczy: wszyscy na starcie z 200 zł, rzuca pierwszy", (n) => {
    const players = [A, B, C, "darek"].slice(0, n);
    const s = game.setup(players, createRng(1));
    const v = view(s);
    for (const p of players) {
      expect(v.positions[p]).toBe(0);
      expect(v.laps[p]).toBe(0);
      expect(v.cash[p]).toBe(START_CASH);
    }
    expect(START_CASH).toBe(200);
    expect(v.owners).toEqual({});
    expect(game.waitingFor(s)).toEqual([A]);
    expect(v.turn).toBe(A);
    expect(v.phase).toBe("roll");
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
    const s = roll(two(), A, 2, 3); // pole 5: Karty Dziekanatu, bez efektu
    expect(view(s).positions[A]).toBe(5);
    expect(view(s).dice).toEqual([2, 3]);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("przejście przez start: okrążenie i 20 zł kieszonkowego", () => {
    const s = roll(with2(two(), { positions: { [A]: 27 } }), A, 6, 4);
    expect(view(s).positions[A]).toBe(5);
    expect(view(s).laps[A]).toBe(1);
    expect(view(s).cash[A]).toBe(START_CASH + ALLOWANCE);
    expect(ALLOWANCE).toBe(20);
  });

  test("dublet daje kolejny rzut (po decyzji o kupnie)", () => {
    let s = roll(two(), A, 1, 1);
    expect(view(s).phase).toBe("buy");
    s = play(s, A, { type: "skip" });
    expect(game.waitingFor(s)).toEqual([A]);
    expect(view(s).phase).toBe("roll");
  });

  test("trzeci dublet z rzędu: ruch, ale koniec tury", () => {
    // Za 5 zł nic się nie kupi, więc nie ma fazy kupna.
    let s = with2(two(), { cash: { [A]: 5 } });
    s = roll(s, A, 1, 1);
    s = roll(s, A, 2, 2);
    s = roll(s, A, 3, 3);
    expect(view(s).positions[A]).toBe(12);
    expect(game.waitingFor(s)).toEqual([B]);
    // Licznik dubletów zeruje się dla kolejnego gracza.
    s = roll(with2(s, { cash: { [B]: 5 } }), B, 1, 1);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("po ostatnim graczu zaczyna się kolejna runda", () => {
    let s = roll(two(), A, 2, 3);
    expect(view(s).round).toBe(1);
    s = roll(s, B, 2, 3);
    expect(view(s).round).toBe(2);
    expect(game.waitingFor(s)).toEqual([A]);
  });
});

describe("kupno", () => {
  test("wolne pole: kupno odejmuje cenę i daje własność", () => {
    let s = roll(two(), A, 1, 2);
    expect(view(s).phase).toBe("buy");
    expect(game.waitingFor(s)).toEqual([A]);
    expect(game.validateMove(s, B, { type: "buy" })).toBe(false);
    expect(game.validateMove(s, A, { type: "roll" })).toBe(false);
    s = play(s, A, { type: "buy" });
    expect(view(s).owners[3]).toBe(A);
    expect(view(s).cash[A]).toBe(START_CASH - price(3));
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("pominięcie zostawia pole wolne", () => {
    let s = roll(two(), A, 1, 2);
    s = play(s, A, { type: "skip" });
    expect(view(s).owners[3]).toBeUndefined();
    expect(view(s).cash[A]).toBe(START_CASH);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("bez pieniędzy na pole nie ma fazy kupna", () => {
    const s = roll(with2(two(), { cash: { [A]: 9 } }), A, 1, 2);
    expect(view(s).owners[3]).toBeUndefined();
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("kupić i pominąć można tylko w fazie kupna", () => {
    expect(game.validateMove(two(), A, { type: "buy" })).toBe(false);
    expect(game.validateMove(two(), A, { type: "skip" })).toBe(false);
  });
});

describe("czynsz i opłaty", () => {
  test("cudze pole: czynsz P/10 dla właściciela", () => {
    const s = roll(with2(two(), { owners: { 4: B } }), A, 1, 3);
    expect(view(s).cash[A]).toBe(START_CASH - 2); // 15 / 10, zaokrąglone
    expect(view(s).cash[B]).toBe(START_CASH + 2);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("cała grupa w rękach właściciela: czynsz ×2", () => {
    const s = roll(with2(two(), { owners: { 4: B, 6: B, 7: B } }), A, 1, 3);
    expect(view(s).cash[A]).toBe(START_CASH - 4);
    expect(view(s).cash[B]).toBe(START_CASH + 4);
  });

  test("własne pole: bez czynszu i bez kupna", () => {
    const s = roll(with2(two(), { owners: { 4: A } }), A, 1, 3);
    expect(view(s).cash[A]).toBe(START_CASH);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("Opłata za akademik: 15 zł dla banku", () => {
    const s = roll(with2(two(), { positions: { [A]: 25 } }), A, 1, 2);
    expect(view(s).positions[A]).toBe(28);
    expect(view(s).cash[A]).toBe(START_CASH - 15);
    expect(view(s).cash[B]).toBe(START_CASH);
  });
});

describe("długi i bankructwo", () => {
  test("brak gotówki: sprzedaż pól bankowi za połowę ceny, potem spłata", () => {
    let s = with2(two(), { cash: { [A]: 3 }, owners: { 1: A, 29: A, 4: B, 6: B, 7: B } });
    s = roll(s, A, 1, 3); // czynsz 4 zł, A ma 3 zł
    expect(view(s).phase).toBe("sell");
    expect(view(s).debt).toEqual({ amount: 4, to: B });
    expect(game.waitingFor(s)).toEqual([A]);
    expect(game.validateMove(s, A, { type: "sell", tile: 4 }), "cudzego pola nie sprzeda").toBe(false);
    expect(game.validateMove(s, A, { type: "roll" })).toBe(false);

    s = play(s, A, { type: "sell", tile: 1 }); // +5 zł
    expect(view(s).owners[1]).toBeUndefined();
    expect(view(s).owners[29]).toBe(A);
    expect(view(s).cash[A]).toBe(3 + 5 - 4);
    expect(view(s).cash[B]).toBe(START_CASH + 4);
    expect(view(s).debt).toBeNull();
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("gdy nawet sprzedaż nie wystarczy: bankructwo, gotówka dla wierzyciela", () => {
    const s = roll(with2(two(), { cash: { [A]: 1 }, owners: { 4: B, 6: B, 7: B } }), A, 1, 3);
    expect(view(s).cash[B]).toBe(START_CASH + 1);
    expect(view(s).bankrupt).toEqual([A]);
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A] });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test("bankrut traci pola i jest pomijany w kolejce", () => {
    // Czynsz za pełną grupę 50 zł to 10 zł; A ma 1 zł i pole warte 5 zł przy sprzedaży.
    let s = with2(three(), { cash: { [A]: 1 }, owners: { 1: A, 29: B, 30: B, 31: B }, positions: { [A]: 26 } });
    s = roll(s, A, 1, 2);
    expect(view(s).positions[A]).toBe(29);
    expect(view(s).bankrupt).toEqual([A]);
    expect(view(s).owners[1]).toBeUndefined();
    expect(game.isOver(s)).toBeNull();
    expect(game.waitingFor(s)).toEqual([B]);
    s = roll(s, B, 2, 3);
    s = roll(s, C, 2, 3);
    expect(game.waitingFor(s)).toEqual([B]);
    expect(view(s).round).toBe(2);
  });
});

describe("limit czasu", () => {
  test("rzut w fazie rzutu, pominięcie w fazie kupna", () => {
    expect(game.timeoutMove!(two(), A, createRng(1))).toEqual({ type: "roll" });
    const s = roll(two(), A, 1, 2);
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual({ type: "skip" });
  });

  test("w fazie sprzedaży sprzedaje najtańsze pole", () => {
    const s = roll(with2(two(), { cash: { [A]: 3 }, owners: { 29: A, 2: A, 4: B, 6: B, 7: B } }), A, 1, 3);
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual({ type: "sell", tile: 2 });
  });
});

describe("koniec gry", () => {
  test(`po ${ROUNDS} rundach koniec, ranking wg majątku (gotówka + ceny pól)`, () => {
    let s = with2(three(), {
      round: ROUNDS,
      cash: { [A]: 50, [B]: 30, [C]: 60 },
      owners: { 29: B },
    });
    s = roll(s, A, 2, 3); // każdy na Karty Dziekanatu, bez efektu
    s = roll(s, B, 2, 3);
    expect(game.isOver(s)).toBeNull();
    s = roll(s, C, 2, 3);
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
    expect(game.waitingFor(s)).toEqual([]);
    expect(view(s).turn).toBeNull();
    expect(game.validateMove(s, A, { type: "roll" })).toBe(false);
  });
});
