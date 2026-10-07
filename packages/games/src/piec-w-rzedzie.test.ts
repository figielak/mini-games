import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { type Move, piecWRzedzie as game } from "./piec-w-rzedzie.ts";

// Testy napisane przed implementacją (etap 2). Ustalają zasady:
// - plansza 15×15, ruch to { x, y } w zakresie 0-14,
// - zaczyna players[0] (kolejność przy rewanżu ustala platforma),
// - wygrywa 5 lub więcej w linii: poziomo, pionowo albo po skosie,
// - pełna plansza bez wygranej to remis: isOver zwraca obiekt bez `winner`.

const A = "ania";
const B = "bartek";
const rng = createRng(1);
const SIZE = 15;

/** Rozgrywa ruchy na zmianę, zaczynając od A. Każdy ruch musi być dozwolony. */
function play(moves: Move[]) {
  let state = game.setup([A, B], rng);
  moves.forEach((move, i) => {
    const player = i % 2 === 0 ? A : B;
    expect(game.validateMove(state, player, move), `ruch ${i + 1}: ${player} na ${move.x},${move.y}`).toBe(true);
    state = game.applyMove(state, player, move, rng);
  });
  return state;
}

/** Przeplata ruchy A z ruchami B: A, B, A, B, ... */
function interleave(a: Move[], b: Move[]): Move[] {
  return a.flatMap((move, i) => (b[i] ? [move, b[i]] : [move]));
}

describe("definicja gry", () => {
  test("gra dla dokładnie 2 graczy", () => {
    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(2);
  });

  test("nowa gra nie jest skończona", () => {
    expect(game.isOver(game.setup([A, B], rng))).toBeNull();
  });
});

describe("kolejność ruchów", () => {
  test("zaczyna pierwszy gracz", () => {
    const state = game.setup([A, B], rng);
    expect(game.validateMove(state, A, { x: 7, y: 7 })).toBe(true);
    expect(game.validateMove(state, B, { x: 7, y: 7 })).toBe(false);
  });

  test("gracze ruszają się na zmianę", () => {
    const state = play([{ x: 7, y: 7 }]);
    expect(game.validateMove(state, A, { x: 8, y: 8 })).toBe(false);
    expect(game.validateMove(state, B, { x: 8, y: 8 })).toBe(true);
  });

  test("ktoś spoza gry nie może wykonać ruchu", () => {
    const state = game.setup([A, B], rng);
    expect(game.validateMove(state, "obcy", { x: 0, y: 0 })).toBe(false);
  });
});

describe("dozwolone pola", () => {
  test("nie można postawić na zajętym polu", () => {
    const state = play([{ x: 7, y: 7 }]);
    expect(game.validateMove(state, B, { x: 7, y: 7 })).toBe(false);
  });

  test.each([
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: SIZE, y: 0 },
    { x: 0, y: SIZE },
    { x: 1.5, y: 2 },
    { x: Number.NaN, y: 0 },
  ])("pole poza planszą jest odrzucane: %o", (move) => {
    expect(game.validateMove(game.setup([A, B], rng), A, move)).toBe(false);
  });

  test("rogi planszy są dozwolone", () => {
    const state = game.setup([A, B], rng);
    for (const move of [
      { x: 0, y: 0 },
      { x: SIZE - 1, y: 0 },
      { x: 0, y: SIZE - 1 },
      { x: SIZE - 1, y: SIZE - 1 },
    ]) {
      expect(game.validateMove(state, A, move)).toBe(true);
    }
  });
});

describe("wygrana", () => {
  // B gra zawsze daleko w górnym wierszu, żeby nie przeszkadzać.
  const filler = (n: number): Move[] => Array.from({ length: n }, (_, i) => ({ x: i * 3, y: 0 }));

  test("5 w poziomie", () => {
    const line = [3, 4, 5, 6, 7].map((x) => ({ x, y: 10 }));
    expect(game.isOver(play(interleave(line, filler(4))))).toEqual({ winner: A });
  });

  test("5 w pionie", () => {
    const line = [5, 6, 7, 8, 9].map((y) => ({ x: 2, y }));
    expect(game.isOver(play(interleave(line, filler(4))))).toEqual({ winner: A });
  });

  test("5 po skosie w dół", () => {
    const line = [0, 1, 2, 3, 4].map((i) => ({ x: 5 + i, y: 5 + i }));
    expect(game.isOver(play(interleave(line, filler(4))))).toEqual({ winner: A });
  });

  test("5 po skosie w górę", () => {
    const line = [0, 1, 2, 3, 4].map((i) => ({ x: 5 + i, y: 12 - i }));
    expect(game.isOver(play(interleave(line, filler(4))))).toEqual({ winner: A });
  });

  test("wygrana przy krawędzi planszy", () => {
    const line = [10, 11, 12, 13, 14].map((x) => ({ x, y: 14 }));
    expect(game.isOver(play(interleave(line, filler(4))))).toEqual({ winner: A });
  });

  test("ostatni kamień w środku linii też wygrywa", () => {
    const line = [3, 4, 6, 7, 5].map((x) => ({ x, y: 10 }));
    expect(game.isOver(play(interleave(line, filler(4))))).toEqual({ winner: A });
  });

  test("6 w linii też wygrywa", () => {
    // A układa 3 4 _ 6 7 8, potem domyka środek: powstaje szóstka.
    const line = [3, 4, 6, 7, 8, 5].map((x) => ({ x, y: 10 }));
    expect(game.isOver(play(interleave(line, filler(5))))).toEqual({ winner: A });
  });

  test("wygrywa też drugi gracz", () => {
    const a: Move[] = [0, 2, 4, 6, 8].map((x) => ({ x, y: 0 }));
    const b: Move[] = [3, 4, 5, 6, 7].map((x) => ({ x, y: 10 }));
    expect(game.isOver(play(interleave(a, b)))).toEqual({ winner: B });
  });

  test("4 w linii to jeszcze nie koniec", () => {
    const line = [3, 4, 5, 6].map((x) => ({ x, y: 10 }));
    expect(game.isOver(play(interleave(line, filler(3))))).toBeNull();
  });

  test("4 przerwane kamieniem przeciwnika to nie wygrana", () => {
    // A: 3 4 _ 6 7 8, B blokuje pole 5.
    const a = [3, 4, 6, 7, 8].map((x) => ({ x, y: 10 }));
    const b = [{ x: 5, y: 10 }, ...filler(4)];
    expect(game.isOver(play(interleave(a, b)))).toBeNull();
  });

  test("kamienie obu graczy w jednej linii się nie sumują", () => {
    const a = [3, 4, 5].map((x) => ({ x, y: 10 }));
    const b = [6, 7].map((x) => ({ x, y: 10 }));
    expect(game.isOver(play(interleave(a, b)))).toBeNull();
  });

  test("po wygranej nikt nie może już ruszyć", () => {
    const line = [3, 4, 5, 6, 7].map((x) => ({ x, y: 10 }));
    const state = play(interleave(line, filler(4)));
    expect(game.validateMove(state, B, { x: 0, y: 14 })).toBe(false);
    expect(game.validateMove(state, A, { x: 0, y: 14 })).toBe(false);
  });
});

describe("remis", () => {
  test("pełna plansza bez 5 w linii to remis", () => {
    // Wzór ((x >> 1) + y) % 2 wypełnia planszę bez żadnej piątki: 113 pól A, 112 pól B.
    const a: Move[] = [];
    const b: Move[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) ((x >> 1) + y) % 2 === 0 ? a.push({ x, y }) : b.push({ x, y });
    }
    const beforeLast = play(interleave(a, b).slice(0, -1));
    expect(game.isOver(beforeLast)).toBeNull();

    const full = play(interleave(a, b));
    expect(game.isOver(full)).toEqual({});
  });
});

describe("stan", () => {
  test("applyMove nie zmienia poprzedniego stanu", () => {
    const before = game.setup([A, B], rng);
    const snapshot = structuredClone(before);
    game.applyMove(before, A, { x: 7, y: 7 }, rng);
    expect(before).toEqual(snapshot);
    expect(game.validateMove(before, A, { x: 7, y: 7 })).toBe(true);
  });

  test("stan da się zapisać jako JSON i odtworzyć (zapis pokoju w SQLite)", () => {
    const state = play([
      { x: 7, y: 7 },
      { x: 8, y: 8 },
    ]);
    const restored = JSON.parse(JSON.stringify(state));
    expect(game.validateMove(restored, A, { x: 9, y: 9 })).toBe(true);
    expect(game.validateMove(restored, A, { x: 8, y: 8 })).toBe(false);
  });

  test("gra nie ma ukrytych informacji: obaj gracze widzą to samo", () => {
    const state = play([
      { x: 7, y: 7 },
      { x: 8, y: 8 },
    ]);
    expect(game.playerView(state, A)).toEqual(game.playerView(state, B));
  });
});

describe("tura i limit czasu", () => {
  test("currentPlayer wskazuje, czyja tura, a po końcu gry zwraca null", () => {
    expect(game.currentPlayer(game.setup([A, B], rng))).toBe(A);
    expect(game.currentPlayer(play([{ x: 7, y: 7 }]))).toBe(B);
    const line = [3, 4, 5, 6, 7].map((x) => ({ x, y: 10 }));
    const filler = [0, 3, 6, 9].map((x) => ({ x, y: 0 }));
    expect(game.currentPlayer(play(interleave(line, filler)))).toBeNull();
  });

  test("ruch po limicie czasu jest dozwolony", () => {
    const state = play([{ x: 7, y: 7 }]);
    for (let seed = 0; seed < 50; seed++) {
      const move = game.timeoutMove!(state, B, createRng(seed));
      expect(game.validateMove(state, B, move)).toBe(true);
    }
  });

  test("ruch po limicie trafia w jedyne wolne pole", () => {
    const a: Move[] = [];
    const b: Move[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) ((x >> 1) + y) % 2 === 0 ? a.push({ x, y }) : b.push({ x, y });
    }
    const moves = interleave(a, b);
    const last = moves.at(-1)!;
    const state = play(moves.slice(0, -1));
    expect(game.timeoutMove!(state, A, createRng(3))).toEqual(last);
  });

  test("limit czasu tury jest ustawiony", () => {
    expect(game.turnSeconds).toBeGreaterThan(0);
  });
});

describe("widok", () => {
  test("pokazuje ostatni ruch i linię wygrywającą", () => {
    const line = [3, 4, 5, 6, 7].map((x) => ({ x, y: 10 }));
    const filler = [0, 3, 6, 9].map((x) => ({ x, y: 0 }));
    const view = game.playerView(play(interleave(line, filler)), A) as {
      lastMove: Move;
      winLine: Move[];
    };
    expect(view.lastMove).toEqual({ x: 7, y: 10 });
    expect(view.winLine).toHaveLength(5);
    expect(view.winLine).toEqual(expect.arrayContaining(line));
  });

  test("schemat ruchu odrzuca śmieci z sieci", () => {
    expect(game.moveSchema.safeParse({ x: 3, y: 4 }).success).toBe(true);
    expect(game.moveSchema.safeParse({ x: "3", y: 4 }).success).toBe(false);
    expect(game.moveSchema.safeParse({ x: 3 }).success).toBe(false);
    expect(game.moveSchema.safeParse(null).success).toBe(false);
  });
});
