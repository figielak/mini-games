import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { kolo as game, judge, type Move, type Point, type State } from "./kolo.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy naraz, każdy rysuje jedno koło, oddaje punkty (współrzędne 0-1 względem płótna),
// - wynik liczy serwer: 0-1000 (dziesiąte części procenta), więcej wyżej,
// - zakładka ponad pełny obrót jest obcinana, niedokończone (< 0,9 obrotu) i za małe (R < 0,15) koło = 0,
// - pusty rysunek = poddanie (0 pkt), to też ruch po limicie czasu.

const A = "ania";
const B = "bartek";
const C = "celina";

/** n punktów co 1/n obrotu, bez domknięcia; `wobble` zmienia promień punktu. */
function circle({ n = 100, turns = 1, r = 0.3, cx = 0.5, cy = 0.5, wobble = (_i: number): number => 0 } = {}): Point[] {
  return Array.from({ length: Math.round(n * turns) }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    const rr = r * (1 + wobble(i));
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  });
}

function square(side = 0.6, perSide = 25): Point[] {
  const lo = 0.5 - side / 2;
  const t = (i: number) => lo + (side * i) / perSide;
  return [
    ...Array.from({ length: perSide }, (_, i): Point => [t(i), lo]),
    ...Array.from({ length: perSide }, (_, i): Point => [lo + side, t(i)]),
    ...Array.from({ length: perSide }, (_, i): Point => [lo + side - (side * i) / perSide, lo + side]),
    ...Array.from({ length: perSide }, (_, i): Point => [lo, lo + side - (side * i) / perSide]),
  ];
}

const score = (points: Point[]) => judge(points).score;
const result = (points: Point[]): Move => ({ type: "result", points });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje rysunek`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

describe("ocena", () => {
  test("idealny okrąg bez domknięcia", () => expect(score(circle())).toBeGreaterThanOrEqual(990));
  test("zakładka 1,3 obrotu jest obcinana", () => expect(score(circle({ turns: 1.3 }))).toBeGreaterThanOrEqual(990));
  test("dwa kółka jedno na drugim jak jedno", () => expect(Math.abs(score(circle({ turns: 2 })) - score(circle()))).toBeLessThanOrEqual(1));
  test("obcięte punkty trafiają do wyniku", () => expect(judge(circle({ turns: 2 })).points.length).toBeLessThan(105));

  test("lekko krzywa ręka: 70-95%", () => {
    const rng = createRng(7);
    const s = score(circle({ wobble: () => 0.02 * (rng() * 2 - 1) }));
    expect(s).toBeGreaterThanOrEqual(700);
    expect(s).toBeLessThanOrEqual(950);
  });

  test("kwadrat < 60%", () => expect(score(square())).toBeLessThan(600));

  test("elipsa 2:1 < 40%", () => {
    const ellipse = circle().map(([x, y]): Point => [0.5 + (x - 0.5) * 1.3, 0.5 + (y - 0.5) * 0.65]);
    expect(score(ellipse)).toBeLessThan(400);
  });

  test("0,8 obrotu: niedokończone", () => {
    expect(judge(circle({ turns: 0.8 }))).toMatchObject({ status: "unfinished", score: 0 });
  });

  test("prosta kreska: niedokończone", () => {
    const line = Array.from({ length: 50 }, (_, i): Point => [0.1 + i * 0.015, 0.5]);
    expect(judge(line)).toMatchObject({ status: "unfinished", score: 0 });
  });

  test("R = 0,1: za małe", () => expect(judge(circle({ r: 0.1 }))).toMatchObject({ status: "small", score: 0 }));

  test("luka 8% obwodu kosztuje", () => expect(score(circle({ turns: 0.92 }))).toBeLessThan(score(circle()) - 30));

  test("położenie nie zmienia wyniku", () => {
    expect(Math.abs(score(circle({ cx: 0.4, cy: 0.6 })) - score(circle()))).toBeLessThanOrEqual(1);
  });
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  test("wszyscy grają naraz, rewanż to nowa partia", () => {
    expect(game.waitingFor(s)).toEqual([A, B]);
    expect(game.setup([A, B], createRng(2)).nonce).not.toBe(s.nonce);
  });
  test("obcy gracz", () => expect(game.validateMove(s, C, result(circle()))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(circle())), A, result(circle()))).toBe(false));
  test("5 punktów", () => expect(game.validateMove(s, A, result(circle().slice(0, 5)))).toBe(false));
  test("ponad 1000 punktów", () => expect(game.validateMove(s, A, result(circle({ n: 1001 })))).toBe(false));
  test("współrzędna poza płótnem", () => expect(game.validateMove(s, A, result([...circle(), [1.5, 0.5]]))).toBe(false));
  test("NaN", () => expect(game.validateMove(s, A, result([...circle(), [Number.NaN, 0.5]]))).toBe(false));
  test("pusty rysunek = poddanie", () => expect(send(s, A, result([]))).toMatchObject({ results: { [A]: { score: 0, points: [] } } }));
});

describe("koniec", () => {
  test("lepsze koło wygrywa", () => {
    let s = game.setup([A, B, C], createRng(1));
    expect(game.isOver(s)).toBeNull();
    s = send(s, A, result(square()));
    s = send(s, B, result(circle()));
    s = send(s, C, result([]));
    expect(s.results[B].score).toBe(score(circle()));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A, C] });
  });

  test("remis: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(circle()));
    s = send(s, B, result(circle()));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("po limicie czasu pusty rysunek", () => {
    const s = game.setup([A, B], createRng(1));
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual(result([]));
  });
});
