import { describe, expect, test } from "vitest";
import { byHitsThenAverage, createRng, ranked, rankPlaces, rankResults, ROOM_CODE_ALPHABET, roomCode, shuffle } from "./core.ts";

test("ten sam seed daje ten sam ciąg", () => {
  const a = createRng(42);
  const b = createRng(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test("rng zwraca liczby z [0, 1)", () => {
  const rng = createRng(1);
  for (let i = 0; i < 1000; i++) {
    const x = rng();
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  }
});

test("kod pokoju ma 4 znaki z alfabetu bez mylących znaków", () => {
  const rng = createRng(7);
  for (let i = 0; i < 200; i++) {
    const code = roomCode(rng);
    expect(code).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{4}$`));
  }
  expect(ROOM_CODE_ALPHABET).not.toMatch(/[O0I1L]/);
});

test("shuffle: permutacja, oryginał bez zmian", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const shuffled = shuffle(items, createRng(3));
  expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  expect(shuffle([], createRng(3))).toEqual([]);
});

describe("rankResults", () => {
  const desc = (a: number, b: number) => b - a;

  test("null, dopóki ktoś nie oddał wyniku (także bez żadnego wyniku)", () => {
    expect(rankResults(["a", "b"], {}, desc)).toBeNull();
    expect(rankResults(["a", "b"], { a: 1 }, desc)).toBeNull();
  });

  test("wynik 0 to też oddany wynik", () => {
    expect(rankResults(["a", "b"], { a: 0, b: 1 }, desc)).toEqual({ winner: "b", ranking: ["b", "a"] });
  });

  test("solo: ranking bez zwycięzcy", () => {
    expect(rankResults(["a"], { a: 5 }, desc)).toEqual({ ranking: ["a"] });
  });

  test("remis na górze: bez zwycięzcy, kolejność miejsc, reszta posortowana", () => {
    expect(rankResults(["a", "b", "c"], { a: 1, b: 5, c: 5 }, desc)).toEqual({ ranking: ["b", "c", "a"] });
    expect(rankResults(["a", "b", "c"], { a: 5, b: 5, c: 5 }, desc)).toEqual({ ranking: ["a", "b", "c"] });
  });

  test("remis poniżej pierwszego miejsca nie odbiera wygranej", () => {
    expect(rankResults(["a", "b", "c"], { a: 2, b: 2, c: 9 }, desc)).toEqual({ winner: "c", ranking: ["c", "a", "b"] });
  });

  test("wynik gracza spoza listy jest ignorowany", () => {
    expect(rankResults(["a", "b"], { a: 1, b: 2, x: 99 }, desc)).toEqual({ winner: "b", ranking: ["b", "a"] });
  });
});

describe("byHitsThenAverage", () => {
  const r = (...times: number[]) => ({ times });

  test("więcej trafień wyżej, potem niższa średnia", () => {
    expect(byHitsThenAverage(r(900, 900), r(100))).toBeLessThan(0);
    expect(byHitsThenAverage(r(200), r(100))).toBeGreaterThan(0);
    expect(byHitsThenAverage(r(100, 300), r(200, 200))).toBe(0);
  });

  test("dwa puste wyniki to remis, nie NaN", () => {
    expect(byHitsThenAverage(r(), r())).toBe(0);
    expect(rankResults(["a", "b"], { a: r(), b: r() }, byHitsThenAverage)).toEqual({ ranking: ["a", "b"] });
  });

  test("pusty wynik przegrywa z każdym trafieniem", () => {
    expect(byHitsThenAverage(r(), r(5000))).toBeGreaterThan(0);
  });
});

describe("rankPlaces: miejsca z remisami (potrzebne w turnieju)", () => {
  const desc = (a: number, b: number) => b - a;

  test("miejsce to 1 + liczba graczy ze ściśle lepszym wynikiem", () => {
    expect(rankPlaces(["a", "b", "c"], { a: 1, b: 9, c: 5 }, desc)).toEqual({ a: 3, b: 1, c: 2 });
  });

  test("remis daje to samo miejsce, następne miejsce przeskakuje", () => {
    expect(rankPlaces(["a", "b", "c", "d"], { a: 5, b: 5, c: 9, d: 1 }, desc)).toEqual({ a: 2, b: 2, c: 1, d: 4 });
    expect(rankPlaces(["a", "b", "c"], { a: 5, b: 5, c: 5 }, desc)).toEqual({ a: 1, b: 1, c: 1 });
  });

  test("solo: pierwsze miejsce", () => {
    expect(rankPlaces(["a"], { a: 0 }, desc)).toEqual({ a: 1 });
  });

  test("ranked: isOver i places z jednego komparatora", () => {
    const game = ranked((s: { players: string[]; results: Record<string, number> }) => s.results, desc);
    expect(game.isOver({ players: ["a", "b"], results: { a: 1 } })).toBeNull();
    const over = { players: ["a", "b", "c"], results: { a: 2, b: 2, c: 9 } };
    expect(game.isOver(over)).toEqual({ winner: "c", ranking: ["c", "a", "b"] });
    expect(game.places(over)).toEqual({ a: 2, b: 2, c: 1 });
  });
});
