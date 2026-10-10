import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { COUNT, distance, type Hsb, hints, kolor as game, type Move, type State } from "./kolor.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy naraz, każdy odtwarza te same 5 kolorów (HSB, całkowite: H 0-359, S i B 0-100),
// - odległość koloru to ΔE (CIE76) w Lab, ucięta do 100; wynik = suma w dziesiątych częściach,
// - mniejsza suma wyżej; pusta odpowiedź (limit czasu) = 100 za każdy kolor.

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (guesses: Hsb[]): Move => ({ type: "result", guesses });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje odpowiedzi`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

const BLACK = { h: 0, s: 0, b: 0 };
const WHITE = { h: 0, s: 0, b: 100 };

test("5 kolorów w zakresach, rewanż ma inne wyzwanie", () => {
  expect(COUNT).toBe(5);
  const s = game.setup([A, B], createRng(1));
  expect(s.targets).toHaveLength(COUNT);
  for (const { h, s: sat, b } of s.targets) {
    expect([h, sat, b].every(Number.isInteger)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
    expect(sat).toBeGreaterThanOrEqual(25);
    expect(sat).toBeLessThanOrEqual(100);
    expect(b).toBeGreaterThanOrEqual(30);
    expect(b).toBeLessThanOrEqual(100);
  }
  expect(game.waitingFor(s)).toEqual([A, B]);
  expect(game.setup([A, B], createRng(2)).targets).not.toEqual(s.targets);
});

describe("odległość", () => {
  test("ten sam kolor = 0", () => expect(distance({ h: 120, s: 60, b: 70 }, { h: 120, s: 60, b: 70 })).toBe(0));
  test("czarny i biały = 100", () => expect(distance(BLACK, WHITE)).toBeCloseTo(100, 0));
  test("barwa zawija się: 359 blisko 0", () =>
    expect(distance({ h: 359, s: 80, b: 80 }, { h: 0, s: 80, b: 80 })).toBeLessThan(2));
  test("ucięta do 100", () => expect(distance({ h: 240, s: 100, b: 100 }, { h: 60, s: 100, b: 100 })).toBe(100));
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  const ok = s.targets;
  test.each([
    ["za mało", ok.slice(0, 4)],
    ["za dużo", [...ok, BLACK]],
    ["barwa 360", [...ok.slice(0, 4), { h: 360, s: 50, b: 50 }]],
    ["ujemne", [...ok.slice(0, 4), { h: 0, s: -1, b: 50 }]],
    ["jasność 101", [...ok.slice(0, 4), { h: 0, s: 50, b: 101 }]],
    ["ułamek", [...ok.slice(0, 4), { h: 0.5, s: 50, b: 50 }]],
  ])("%s", (_, guesses) => expect(game.validateMove(s, A, result(guesses))).toBe(false));
  test("obcy gracz", () => expect(game.validateMove(s, C, result(ok))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(ok)), A, result(ok))).toBe(false));
  test("pusta odpowiedź", () => expect(game.validateMove(s, A, result([]))).toBe(true));
});

describe("koniec", () => {
  test("bezbłędnie = 0, pusta = 500 pkt kary (w dziesiątych 5000), odpowiedzi zostają w stanie", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(s.targets));
    s = send(s, B, result([]));
    expect(s.results).toEqual({ [A]: 0, [B]: 5000 });
    expect(s.guesses[A]).toEqual(s.targets);
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
  });

  test("mniejsza suma wygrywa", () => {
    let s = game.setup([A, B, C], createRng(1));
    const off = (d: number) => s.targets.map((t) => ({ ...t, b: t.b > 50 ? t.b - d : t.b + d }));
    expect(game.isOver(s)).toBeNull();
    s = send(s, A, result(off(30)));
    s = send(s, B, result(off(2)));
    s = send(s, C, result(off(10)));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("remis: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(s.targets));
    s = send(s, B, result(s.targets));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("po limicie czasu pusta odpowiedź", () => {
    const s = game.setup([A, B], createRng(1));
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual(result([]));
  });
});

describe("Odcień: podpowiedzi po zatwierdzeniu", () => {
  const t: Hsb = { h: 30, s: 60, b: 60 };

  test("blisko wzoru nie ma podpowiedzi", () => {
    expect(hints(t, { h: 35, s: 65, b: 56 })).toEqual([]);
  });

  test("jasność i nasycenie", () => {
    expect(hints(t, { ...t, b: 40 })).toEqual(["za ciemny"]);
    expect(hints(t, { ...t, b: 80, s: 40 })).toEqual(["za jasny", "za mało nasycony"]);
    expect(hints(t, { ...t, s: 90 })).toEqual(["zbyt nasycony"]);
  });

  test("barwa: kierunek do najbliższej barwy podstawowej, także przez 0°", () => {
    expect(hints(t, { ...t, h: 50 })).toEqual(["za bardzo w stronę żółci"]);
    expect(hints(t, { ...t, h: 10 })).toEqual(["za bardzo w stronę czerwieni"]);
    expect(hints({ ...t, h: 0 }, { ...t, h: 340 })).toEqual(["za bardzo w stronę magenty"]);
    expect(hints({ ...t, h: 350 }, { ...t, h: 20 })).toEqual(["za bardzo w stronę czerwieni"]);
  });
});
