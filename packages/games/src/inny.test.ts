import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { ANGLE_MAX, ANGLE_MIN, HARD, inny as game, LIGHT_MAX, LIGHT_MIN, MAX_SIDE, type Move, SHAPE_BOARDS, SIZE_MAX, SIZE_MIN, type State, type View } from "./inny.ts";
import { DURATION_MS } from "./quiz.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - wszyscy dostają te same plansze: siatka symboli `base`, na polu `odd` symbol `other`,
// - siatka rośnie z każdą planszą na przemian o kolumnę i wiersz, od 2×2 do 6×6,
// - `other` różni się od `base` dokładnie jednym: obrotem (trójkąt), jasnością, rozmiarem albo liczbą boków (±1),
// - kształt jest losowany tylko dopóki siatka rośnie (plansze 0-7), potem zostają subtelne różnice,
// - różnica maleje liniowo od planszy 0 do HARD, dalej jest stała,
// - klient oddaje czasy trafień (150-5000 ms, razem max 30 s) i liczbę pomyłek,
// - ranking: więcej trafień wyżej, remis rozstrzyga niższa średnia.

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (times: number[], errors = 0): Move => ({ type: "result", times, errors });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

const trialsOf = (seed: number) => (game.playerView(game.setup([A, B], createRng(seed)), A) as View).trials;
const FIELDS = ["sides", "angle", "hue", "light", "size"] as const;
/** Pola symbolu, którymi `other` różni się od `base`. */
const diff = (t: View["trials"][number]) => FIELDS.filter((f) => t.base[f] !== t.other[f]);
/** Wszystkie plansze z kilku losowań o danym rodzaju różnicy, z numerem planszy. */
const ofKind = (field: (typeof FIELDS)[number]) =>
  Array.from({ length: 20 }, (_, k) => k + 1).flatMap((seed) => trialsOf(seed).map((t, i) => ({ t, i }))).filter(({ t }) => diff(t)[0] === field);

test("definicja: 1-6 graczy, limit 90 s, świeża gra trwa", () => {
  expect([game.id, game.minPlayers, game.maxPlayers, game.turnSeconds]).toEqual(["inny", 1, 6, 90]);
  const s = game.setup([A, B], createRng(1));
  expect(game.isOver(s)).toBeNull();
  expect(game.waitingFor(s)).toEqual([A, B]);
});

describe("plansze", () => {
  test("wystarczy ich na 30 s", () => expect(trialsOf(1).length * 150).toBeGreaterThanOrEqual(DURATION_MS));

  test("ten sam seed daje te same plansze, inny seed (rewanż) inne", () => {
    expect(trialsOf(1)).toEqual(trialsOf(1));
    expect(trialsOf(1)).not.toEqual(trialsOf(2));
  });

  test("siatka rośnie z każdym trafieniem na przemian o kolumnę i wiersz, od 2×2 do 6×6", () => {
    const sizes = trialsOf(1).map((t) => `${t.cols}×${t.rows}`);
    expect(sizes.slice(0, 10)).toEqual(["2×2", "3×2", "3×3", "4×3", "4×4", "5×4", "5×5", "6×5", "6×6", "6×6"]);
    expect(sizes.slice(8).every((s) => s === `${MAX_SIDE}×${MAX_SIDE}`)).toBe(true);
  });

  test("inny element leży na planszy, a nie zawsze w tym samym miejscu", () => {
    const trials = trialsOf(1);
    expect(trials.every((t) => Number.isInteger(t.odd) && t.odd >= 0 && t.odd < t.cols * t.rows)).toBe(true);
    expect(new Set(trials.slice(8).map((t) => t.odd)).size).toBeGreaterThan(20);
  });

  test("inny element różni się dokładnie jednym: obrotem, odcieniem, rozmiarem albo kształtem", () => {
    for (const t of trialsOf(1)) expect(diff(t)).toHaveLength(1);
    for (const field of ["angle", "light", "size"] as const) expect(ofKind(field).length, field).toBeGreaterThan(1000);
    expect(ofKind("sides").length).toBeGreaterThan(20);
    expect(ofKind("hue")).toHaveLength(0);
  });

  test("symbol da się narysować: co najmniej 3 boki, całkowite kąty, jasność widoczna na ciemnym tle, rozmiar mieści się w polu", () => {
    for (const t of trialsOf(1))
      for (const s of [t.base, t.other]) {
        expect(FIELDS.every((f) => Number.isInteger(s[f]))).toBe(true);
        expect(s.sides).toBeGreaterThanOrEqual(3);
        expect(s.light).toBeGreaterThanOrEqual(25);
        expect(s.light).toBeLessThanOrEqual(85);
        expect(s.size).toBeGreaterThanOrEqual(50);
        expect(s.size).toBeLessThanOrEqual(100);
      }
  });

  test("obrót: trójkąt, różnica od 40° na pierwszej planszy do 8° od planszy 16", () => {
    for (const { t, i } of ofKind("angle")) {
      expect(t.base.sides).toBe(3);
      const d = Math.abs(t.other.angle - t.base.angle);
      if (i === 0) expect(d).toBe(ANGLE_MAX);
      if (i >= HARD) expect(d).toBe(ANGLE_MIN);
      expect(d).toBeGreaterThanOrEqual(ANGLE_MIN);
      expect(d).toBeLessThanOrEqual(ANGLE_MAX);
    }
    expect([ANGLE_MAX, ANGLE_MIN, HARD]).toEqual([40, 8, 16]);
  });

  test("odcień: różnica jasności od 20 na pierwszej planszy do 5 od planszy 16", () => {
    for (const { t, i } of ofKind("light")) {
      const d = Math.abs(t.other.light - t.base.light);
      if (i === 0) expect(d).toBe(LIGHT_MAX);
      if (i >= HARD) expect(d).toBe(LIGHT_MIN);
      expect(d).toBeGreaterThanOrEqual(LIGHT_MIN);
      expect(d).toBeLessThanOrEqual(LIGHT_MAX);
    }
    expect([LIGHT_MAX, LIGHT_MIN]).toEqual([20, 5]);
  });

  test("rozmiar: różnica od 20 na pierwszej planszy do 10 od planszy 16, przy bazowym 80", () => {
    for (const { t, i } of ofKind("size")) {
      expect(t.base.size).toBe(80);
      const d = Math.abs(t.other.size - t.base.size);
      if (i === 0) expect(d).toBe(SIZE_MAX);
      if (i >= HARD) expect(d).toBe(SIZE_MIN);
      expect(d).toBeGreaterThanOrEqual(SIZE_MIN);
      expect(d).toBeLessThanOrEqual(SIZE_MAX);
    }
    expect([SIZE_MAX, SIZE_MIN]).toEqual([20, 10]);
  });

  test("różnica maleje z numerem planszy", () => {
    const at = (i: number) => Math.abs(ofKind("angle").find((x) => x.i === i)!.t.other.angle - ofKind("angle").find((x) => x.i === i)!.t.base.angle);
    const picks = [...new Set(ofKind("angle").map((x) => x.i))].filter((i) => i <= HARD).sort((a, b) => a - b);
    for (let k = 1; k < picks.length; k++) expect(at(picks[k])).toBeLessThan(at(picks[k - 1]));
  });

  test("kształt: zawsze o jeden bok, boków przybywa co 3 plansze, tylko dopóki siatka rośnie (plansze 0-7)", () => {
    expect(SHAPE_BOARDS).toBe(8);
    for (const { t, i } of ofKind("sides")) {
      expect(i).toBeLessThan(SHAPE_BOARDS);
      expect(t.base.sides).toBe(3 + Math.floor(i / 3));
      expect(Math.abs(t.other.sides - t.base.sides)).toBe(1);
    }
    expect(ofKind("sides").some(({ t }) => t.other.sides < t.base.sides)).toBe(true);
  });
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  test.each([
    ["za szybko", result([149])],
    ["za wolno", result([5001])],
    ["ponad 30 s", result(Array(11).fill(3000))],
    ["ujemne pomyłki", result([500], -1)],
    ["niecałkowite pomyłki", result([500], 1.5)],
  ])("%s", (_, move) => expect(game.validateMove(s, A, move)).toBe(false));
  test("wartości brzegowe przechodzą", () => expect(game.validateMove(s, A, result([150, 5000]))).toBe(true));
  test("obcy gracz", () => expect(game.validateMove(s, C, result([500]))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result([500])), A, result([400]))).toBe(false));
  test("po końcu gry", () => expect(game.validateMove(send(send(s, A, result([500])), B, result([400])), A, result([400]))).toBe(false));
  test("pusty wynik", () => expect(game.validateMove(s, A, result([], 4))).toBe(true));
});

describe("schemat", () => {
  test.each([
    ["zły typ ruchu", { type: "tap", times: [], errors: 0 }],
    ["brak czasów", { type: "result", errors: 0 }],
    ["czas tekstem", { type: "result", times: ["500"], errors: 0 }],
    ["za dużo czasów", { type: "result", times: Array(201).fill(150), errors: 0 }],
    ["niecałkowite pomyłki", { type: "result", times: [], errors: 0.5 }],
  ])("%s", (_, move) => expect(game.moveSchema.safeParse(move).success).toBe(false));
  test("poprawny ruch", () => expect(game.moveSchema.safeParse(result([500], 2)).success).toBe(true));
});

describe("koniec", () => {
  test.each([
    [A, [A, C, B]],
    [B, [B, A, C]],
    [C, [C, A, B]],
  ])("więcej trafień wygrywa (%s), remis rozstrzyga średnia", (winner, ranking) => {
    let s = game.setup([A, B, C], createRng(1));
    for (const p of [A, B, C]) {
      expect(game.isOver(s)).toBeNull();
      // Zwycięzca ma 3 trafienia, pozostali po 2; z nich wyżej ten z niższą średnią.
      s = send(s, p, p === winner ? result([700, 700, 700], 5) : result(p === ranking[1] ? [500, 500] : [600, 600]));
    }
    expect(game.isOver(s)).toEqual({ winner, ranking });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test("remis na górze i dwa puste wyniki: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result([600, 400]));
    expect(game.waitingFor(s)).toEqual([B]);
    s = send(s, B, result([500, 500], 3));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });

    let t = game.setup([A, B], createRng(1));
    t = send(t, A, result([]));
    t = send(t, B, result([], 7));
    expect(game.isOver(t)).toEqual({ ranking: [A, B] });
  });

  test("gra solo kończy się rankingiem bez zwycięzcy", () => {
    expect(game.isOver(send(game.setup([A], createRng(1)), A, result([500])))).toEqual({ ranking: [A] });
  });

  test("po limicie czasu pusty wynik, który przechodzi walidację", () => {
    const s = game.setup([A], createRng(1));
    const move = game.timeoutMove!(s, A, createRng(1));
    expect(move).toEqual(result([]));
    expect(game.validateMove(s, A, move)).toBe(true);
  });
});

test("applyMove nie zmienia poprzedniego stanu, stan przeżywa JSON", () => {
  const s = game.setup([A, B], createRng(1));
  const before = JSON.stringify(s);
  const next = send(s, A, result([500]));
  expect(JSON.stringify(s)).toBe(before);
  expect(JSON.parse(JSON.stringify(next))).toEqual(next);
});
