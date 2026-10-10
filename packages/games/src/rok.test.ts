import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { EVENTS, MIN_YEAR, MAX_YEAR, rok as game, type Move, ROUNDS, type State, type View } from "./rok.ts";

// Ustalają zasady:
// - 1-6 graczy naraz, każdy dostaje te same 10 wydarzeń z puli (rok 1900-2025, tekst bez roku),
// - odpowiedź to 10 lat całkowitych z zakresu; wynik = suma |odpowiedź − rok|, mniejsza suma wyżej,
// - pusta odpowiedź (limit czasu) liczy się w każdej rundzie jak najgorszy możliwy błąd,
// - ruch progress zgłasza liczbę odpowiedzianych rund (1-9) do podglądu u rywali i nie odnawia limitu.

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

test("definicja: 1-6 graczy, limit 240 s, świeża gra trwa", () => {
  expect([game.minPlayers, game.maxPlayers, game.turnSeconds]).toEqual([1, 6, 240]);
  expect(game.isOver(game.setup([A, B], createRng(1)))).toBeNull();
});

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
  ])("%s", (_, answers) => expect(game.validateMove(s, A, result(answers))).toBe(false));

  test("obcy gracz", () => expect(game.validateMove(s, C, result(ok))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(ok)), A, result(ok))).toBe(false));
  test("pusta odpowiedź", () => expect(game.validateMove(s, A, result([]))).toBe(true));
  test("krańce zakresu przechodzą", () => {
    expect(game.validateMove(s, A, result([...ok.slice(0, 9), MIN_YEAR]))).toBe(true);
    expect(game.validateMove(s, A, result([...ok.slice(0, 9), MAX_YEAR]))).toBe(true);
  });
  test("po końcu gry", () => {
    const over = send(send(s, A, result(ok)), B, result(ok));
    expect(game.validateMove(over, A, result(ok))).toBe(false);
    expect(game.validateMove(over, A, progress(3))).toBe(false);
  });
});

describe("liczenie i koniec", () => {
  test("bezbłędnie = 0, błędy w obie strony sumują się, pusta lista = najgorszy możliwy wynik, odpowiedzi zostają w stanie", () => {
    let s = game.setup([A, B, C], createRng(1));
    const exact = years(s);
    const worst = exact.map((year) => Math.max(year - MIN_YEAR, MAX_YEAR - year));
    s = send(s, A, result(exact));
    s = send(s, B, result([]));
    // Rok obok prawdziwego, na przemian w obie strony (bez wychodzenia poza zakres).
    const near = exact.map((year, i) => (i % 2 && year < MAX_YEAR ? year + 1 : year - 1));
    s = send(s, C, result(near));
    expect(s.results).toEqual({ [A]: 0, [B]: worst.reduce((a, b) => a + b, 0), [C]: ROUNDS });
    expect(s.answers).toEqual({ [A]: exact, [B]: [], [C]: near });
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, C, B] });
  });

  test("mniejsza suma wygrywa, niezależnie od miejsca; waitingFor kurczy się do pustego", () => {
    let s = game.setup([A, B, C], createRng(1));
    // Przesunięcie w stronę środka zakresu, żeby odpowiedź została w 1900-2025.
    const off = (d: number) => years(s).map((y) => (y < 1960 ? y + d : y - d));
    s = send(s, A, result(off(3)));
    expect(game.waitingFor(s)).toEqual([B, C]);
    expect(game.isOver(s)).toBeNull();
    s = send(s, B, result(off(1)));
    s = send(s, C, result(off(2)));
    expect(s.results).toEqual({ [A]: 30, [B]: 10, [C]: 20 });
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
    expect(game.waitingFor(s)).toEqual([]);
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

  test("timeoutMove przechodzi validateMove, applyMove nie zmienia poprzedniego stanu, stan przeżywa JSON", () => {
    const s = game.setup([A, B], createRng(1));
    const before = JSON.stringify(s);
    const t = game.timeoutMove!(s, A, createRng(1));
    expect(game.validateMove(s, A, t)).toBe(true);
    const next = game.applyMove(s, A, t, createRng(1));
    game.applyMove(s, A, progress(3), createRng(1));
    expect(JSON.stringify(s)).toBe(before);
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
