import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { ACCEPT_PX, distance, FIELD, srodek as game, MARGIN, MAX_DISTANCE, MAX_LEN, MIN_LEN, type Move, offset, type Point, project, ROUNDS, type Segment, type State } from "./srodek.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy naraz, każdy dostaje te same 10 odcinków (długość MIN_LEN-MAX_LEN boku pola, końce w marginesie),
// - odpowiedź to 10 punktów dotknięcia; każdy jest rzutowany prostopadle na prostą odcinka, a błąd rundy to odległość rzutu
//   od środka wzdłuż odcinka w umownych px (pole ma bok FIELD); odchylenie w bok nic nie kosztuje,
// - dotknięcie dalej niż ACCEPT_PX od odcinka nie jest odpowiedzią (ruch odrzucony),
// - wynik = suma błędów w dziesiątych częściach (int), mniejsza wyżej; pusta odpowiedź (limit czasu) to 10 × MAX_DISTANCE,
//   czyli więcej niż najgorsza uczciwa partia.

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (taps: Point[]): Move => ({ type: "result", taps });
const mids = (s: State): Point[] => s.segments.map(({ a, b }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));
const mid = ({ a, b }: Segment): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
/** Punkt przesunięty od środka o `along` umownych px wzdłuż odcinka (w stronę b) i `side` px w bok. */
function at({ a, b }: Segment, along: number, side = 0): Point {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const m = mid({ a, b });
  return { x: m.x + (ux * along - uy * side) / FIELD, y: m.y + (uy * along + ux * side) / FIELD };
}
/** Każde dotknięcie przesunięte wzdłuż odcinka o `px` umownych pikseli. */
const off = (s: State, px: number) => s.segments.map((seg) => at(seg, px));

/** Połowa długości odcinka w umownych px. */
const halfPx = ({ a, b }: Segment) => (Math.hypot(b.x - a.x, b.y - a.y) / 2) * FIELD;

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje odpowiedzi`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

test("definicja: 1-6 graczy, limit 60 s, świeża gra trwa", () => {
  expect(game.minPlayers).toBe(1);
  expect(game.maxPlayers).toBe(6);
  expect(game.turnSeconds).toBe(60);
  expect(game.isOver(game.setup([A], createRng(1)))).toBeNull();
});

test("10 odcinków, końce w marginesie, długość w zakresie, rewanż ma inne wyzwanie", () => {
  expect(ROUNDS).toBe(10);
  const angles = new Set<number>();
  for (let seed = 1; seed <= 20; seed++) {
    const s = game.setup([A, B], createRng(seed));
    expect(s.segments).toHaveLength(ROUNDS);
    for (const { a, b } of s.segments) {
      for (const v of [a.x, a.y, b.x, b.y]) {
        expect(v).toBeGreaterThanOrEqual(MARGIN);
        expect(v).toBeLessThanOrEqual(1 - MARGIN);
      }
      const length = Math.hypot(a.x - b.x, a.y - b.y);
      expect(length).toBeGreaterThanOrEqual(MIN_LEN - 1e-9);
      expect(length).toBeLessThanOrEqual(MAX_LEN + 1e-9);
      angles.add(Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI));
    }
  }
  // Kąt jest losowy, nie tylko poziomo i pionowo.
  expect(angles.size).toBeGreaterThan(50);
  const s = game.setup([A, B], createRng(1));
  expect(game.waitingFor(s)).toEqual([A, B]);
  expect(game.setup([A, B], createRng(1))).toEqual(s);
  expect(game.setup([A, B], createRng(2)).segments).not.toEqual(s.segments);
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  const ok = mids(s);
  const last = (p: unknown) => [...ok.slice(0, 9), p as Point];
  test.each([
    ["za mało", ok.slice(0, 9)],
    ["za dużo", [...ok, ok[0]]],
    ["tuż za strefą w bok", last(at(s.segments[9], 0, ACCEPT_PX + 1))],
    ["tuż za strefą za końcem", last(at(s.segments[9], halfPx(s.segments[9]) + ACCEPT_PX + 1))],
    ["NaN", last({ x: Number.NaN, y: 0.5 })],
    ["nieskończoność", last({ x: 0.5, y: Number.POSITIVE_INFINITY })],
  ])("odrzucone: %s", (_, taps) => expect(game.validateMove(s, A, result(taps))).toBe(false));
  test("tuż w strefie przechodzi: w bok i za końcem odcinka", () => {
    expect(game.validateMove(s, A, result(last(at(s.segments[9], 0, ACCEPT_PX - 1))))).toBe(true);
    expect(game.validateMove(s, A, result(last(at(s.segments[9], -halfPx(s.segments[9]) - ACCEPT_PX + 1))))).toBe(true);
  });
  test("obcy gracz", () => expect(game.validateMove(s, C, result(ok))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(ok)), A, result(ok))).toBe(false));
  test("pusta odpowiedź", () => expect(game.validateMove(s, A, result([]))).toBe(true));

  test("schemat odrzuca śmieci z sieci", () => {
    const parses = (m: unknown) => game.moveSchema.safeParse(m).success;
    expect(parses(result(ok))).toBe(true);
    expect(parses(result([]))).toBe(true);
    expect(parses({ type: "result" })).toBe(false);
    expect(parses({ type: "result", taps: [{ x: "0.5", y: 0.5 }] })).toBe(false);
    expect(parses({ type: "result", taps: [{ x: 0.5 }] })).toBe(false);
    expect(parses({ type: "result", taps: Array(ROUNDS + 1).fill({ x: 0.5, y: 0.5 }) })).toBe(false);
    expect(parses({ type: "skok" })).toBe(false);
  });
});

describe("błąd rundy", () => {
  const segment = { a: { x: 0.2, y: 0.2 }, b: { x: 0.6, y: 0.8 } };
  test("w środku = 0", () => expect(distance(segment, { x: 0.4, y: 0.5 })).toBeCloseTo(0));
  test("liczony wzdłuż odcinka w umownych px, w obie strony tak samo", () => {
    expect(FIELD).toBe(300);
    expect(distance(segment, at(segment, 30))).toBeCloseTo(30);
    expect(distance(segment, at(segment, -30))).toBeCloseTo(30);
    expect(distance(segment, segment.a)).toBeCloseTo(halfPx(segment));
  });
  test("odchylenie w bok nic nie kosztuje", () => {
    expect(distance(segment, at(segment, 0, 25))).toBeCloseTo(0);
    expect(distance(segment, at(segment, 12, -25))).toBeCloseTo(12);
  });
  test("rzut leży na odcinku, prostopadle pod dotknięciem", () => {
    const p = project(segment, at(segment, 12, 25));
    const on = at(segment, 12);
    expect(p.x).toBeCloseTo(on.x);
    expect(p.y).toBeCloseTo(on.y);
  });
  test("za końcem odcinka błąd rośnie dalej", () => expect(distance(segment, at(segment, halfPx(segment) + 20))).toBeCloseTo(halfPx(segment) + 20));
});

describe("strefa akceptacji", () => {
  const segment = { a: { x: 0.2, y: 0.2 }, b: { x: 0.6, y: 0.8 } };
  test("odległość od odcinka: w bok prostopadle, za końcem od końca", () => {
    expect(ACCEPT_PX).toBe(30);
    expect(offset(segment, at(segment, 40))).toBeCloseTo(0);
    expect(offset(segment, at(segment, 40, 18))).toBeCloseTo(18);
    expect(offset(segment, at(segment, halfPx(segment) + 20))).toBeCloseTo(20);
    expect(offset(segment, at(segment, halfPx(segment) + 30, 40))).toBeCloseTo(50);
  });
  test("najgorsza uczciwa runda kosztuje mniej niż runda po limicie czasu", () => {
    expect(MAX_DISTANCE).toBe(150);
    expect((MAX_LEN / 2) * FIELD + ACCEPT_PX).toBeLessThan(MAX_DISTANCE);
  });
});

describe("koniec", () => {
  test("bezbłędnie = 0, pusta = 10 × MAX_DISTANCE, dotknięcia zostają w stanie", () => {
    let s = game.setup([A, B], createRng(1));
    const before = JSON.stringify(s);
    const next = send(s, A, result(mids(s)));
    expect(JSON.stringify(s), "applyMove nie zmienia poprzedniego stanu").toBe(before);
    s = send(next, B, result([]));
    expect(s.results).toEqual({ [A]: 0, [B]: ROUNDS * MAX_DISTANCE * 10 });
    expect(s.taps[A]).toEqual(mids(s));
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
    expect(game.waitingFor(s)).toEqual([]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  test("odległości się sumują w dziesiątych px, mniejsza suma wygrywa (także gdy to nie pierwszy gracz)", () => {
    let s = game.setup([A, B, C], createRng(1));
    expect(game.isOver(s)).toBeNull();
    s = send(s, A, result(off(s, 3)));
    expect(game.waitingFor(s)).toEqual([B, C]);
    s = send(s, B, result(off(s, 1.25)));
    s = send(s, C, result(off(s, 2)));
    expect(s.results).toEqual({ [A]: 300, [B]: 125, [C]: 200 });
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("remis: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(off(s, 2)));
    s = send(s, B, result(off(s, 2)));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("gra solo kończy się rankingiem bez zwycięzcy", () => {
    const s = game.setup([A], createRng(1));
    expect(game.isOver(send(s, A, result(mids(s))))).toEqual({ ranking: [A] });
  });

  test("po limicie czasu pusta odpowiedź, czyli najgorszy możliwy wynik", () => {
    const s = game.setup([A, B], createRng(1));
    const move = game.timeoutMove!(s, A, createRng(1));
    expect(move).toEqual(result([]));
    // Rywal trafia w każdej rundzie najgorzej, jak się da: na skraj strefy za końcem odcinka.
    const far = send(s, B, result(s.segments.map((seg) => at(seg, halfPx(seg) + ACCEPT_PX - 1))));
    expect(send(far, A, move).results[A]).toBe(ROUNDS * MAX_DISTANCE * 10);
    expect(far.results[B]).toBeLessThan(ROUNDS * MAX_DISTANCE * 10);
  });
});
