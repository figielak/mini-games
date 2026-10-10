import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { EVENTS, MIN_YEAR, MAX_YEAR, rok as game, type Move, ROUNDS, type State, type View } from "./rok.ts";

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (answers: number[]): Move => ({ type: "result", answers });
const progress = (done: number): Move => ({ type: "progress", done });
const years = (s: State) => s.events.map((e) => e.year);

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje ruch`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

test("10 rund, zakres lat, unikatowe teksty, ten sam seed i inne seedy", () => {
  expect(ROUNDS).toBe(10);
  expect(EVENTS.length).toBeGreaterThanOrEqual(100);
  for (let seed = 1; seed <= 20; seed++) {
    const s = game.setup([A, B], createRng(seed));
    expect(s.events).toHaveLength(ROUNDS);
    expect(new Set(s.events.map((e) => e.text)).size).toBe(ROUNDS);
    expect(s.events.every((e) => e.text.length > 0)).toBe(true);
    expect(s.events.every((e) => e.year >= MIN_YEAR && e.year <= MAX_YEAR)).toBe(true);
    expect(s.events.every((e) => !/\d{4}/.test(e.text))).toBe(true);
    for (const event of s.events) {
      expect(Number.isInteger(event.year)).toBe(true);
    }
  }
  const one = game.setup([A, B], createRng(7));
  const same = game.setup([A, B], createRng(7));
  expect(one).toEqual(same);
  expect(game.setup([A, B], createRng(8))).not.toEqual(one);
  expect(game.waitingFor(one)).toEqual([A, B]);
});

test("pula: każdy rok w zakresie, teksty bez powtórek i bez czterocyfrowej liczby", () => {
  expect(new Set(EVENTS.map((e) => e.text)).size).toBe(EVENTS.length);
  for (const e of EVENTS) {
    expect(Number.isInteger(e.year) && e.year >= MIN_YEAR && e.year <= MAX_YEAR, e.text).toBe(true);
    expect(e.text, e.text).not.toMatch(/\d{4}/);
    expect(e.text.trim()).toBe(e.text);
    expect(e.text.length).toBeGreaterThan(0);
  }
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  const ok = years(s);

  test.each([
    ["za mało", ok.slice(0, 9)],
    ["za dużo", [...ok, 1900]],
    ["1899", [...ok.slice(0, 9), 1899]],
    ["2026", [...ok.slice(0, 9), 2026]],
    ["ułamek", [...ok.slice(0, 9), 1962.5]],
    ["ułamek 2", [...ok.slice(0, 9), 2.5]],
  ])("%s", (_, answers) => expect(game.validateMove(s, A, result(answers))).toBe(false));

  test("obcy gracz", () => expect(game.validateMove(s, C, result(ok))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(ok)), A, result(ok))).toBe(false));
  test("pusta odpowiedź", () => expect(game.validateMove(s, A, result([]))).toBe(true));
  test("pusta lista nie odblokowuje limitu", () => expect(game.waitingFor(s)).toEqual([A, B]));
});

describe("liczenie i koniec", () => {
  test("bezbłędnie = 0, błędy w obie strony sumują się, pusta lista = najgorszy możliwy wynik", () => {
    let s = game.setup([A, B, C], createRng(1));
    const exact = years(s);
    const worst = exact.map((year) => Math.max(year - MIN_YEAR, MAX_YEAR - year));
    s = send(s, A, result(exact));
    s = send(s, B, result([]));
    s = send(s, C, result(new Array(ROUNDS).fill(MIN_YEAR)));
    expect(s.results).toEqual({ [A]: 0, [B]: worst.reduce((a, b) => a + b, 0), [C]: exact.reduce((sum, year) => sum + year - MIN_YEAR, 0) });
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B, C] });
  });

  test("remis i solo bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(years(s)));
    s = send(s, B, result(years(s)));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
    const solo = game.setup([A], createRng(1));
    const alone = send(solo, A, result(years(solo)));
    expect(game.isOver(alone)).toEqual({ ranking: [A] });
    expect(game.waitingFor(alone)).toEqual([]);
  });

  test("timeoutMove przechodzi validateMove i applyMove nie mutuje stan", () => {
    const s = game.setup([A, B], createRng(1));
    const t = game.timeoutMove!(s, A, createRng(1));
    expect(game.validateMove(s, A, t)).toBe(true);
    const next = game.applyMove(s, A, t, createRng(1));
    expect(next).not.toBe(s);
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  });
});

describe("progress i schemat", () => {
  const s = game.setup([A, B], createRng(1));

  test("0, 10 i ułamek odrzucają, widzą go wszyscy, nie zmienia waitingFor, może spaść", () => {
    expect((game.playerView(s, B) as View).progress).toEqual({});
    const after = send(s, A, progress(3));
    expect((game.playerView(after, B) as View).progress).toEqual({ [A]: 3 });
    expect((game.playerView(after, "") as View).progress).toEqual({ [A]: 3 });
    expect(game.waitingFor(after)).toEqual([A, B]);
    expect(send(send(s, A, progress(5)), A, progress(1)).progress[A]).toBe(1);
    expect(game.validateMove(after, A, result(years(s)))).toBe(true);
  });

  test.each([
    ["zero", progress(0)],
    ["dziesięć", progress(10)],
    ["ułamek", progress(1.5)],
  ])("odrzucony: %s", (_, move) => expect(game.validateMove(s, A, move)).toBe(false));

  test("obcy gracz i po wyniku", () => {
    expect(game.validateMove(s, C, progress(3))).toBe(false);
    expect(game.validateMove(send(s, A, result(years(s))), A, progress(3))).toBe(false);
  });

  test("turn ma stały klucz i nie odnawia limitu", () => {
    expect(game.turn!(s)).toEqual({ key: "run", seconds: game.turnSeconds });
    expect(game.turn!(send(s, A, progress(5)))).toEqual(game.turn!(s));
  });

  test("schemat odrzuca śmieci z sieci", () => {
    const ok = (m: unknown) => game.moveSchema.safeParse(m).success;
    expect(ok(progress(3))).toBe(true);
    expect(ok(result([]))).toBe(true);
    expect(ok({ type: "progress" })).toBe(false);
    expect(ok({ type: "progress", done: "3" })).toBe(false);
    expect(ok({ type: "result", answers: Array(ROUNDS + 1).fill(1) })).toBe(false);
    expect(ok({ type: "skok" })).toBe(false);
  });
});
