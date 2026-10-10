import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { kat as game, MAX, MAX_ANSWER, MIN, type Move, ROUNDS, type State, type View } from "./kat.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy naraz, każdy ocenia te same 10 kątów (całe stopnie MIN-MAX, losowy obrót 0-359),
// - odpowiedź to 10 liczb całkowitych 0-180; wynik = suma błędów |odpowiedź − kąt|, mniejsza suma wyżej,
// - pusta odpowiedź (limit czasu) liczy się w każdej rundzie jak najgorszy możliwy błąd,
// - ruch progress zgłasza liczbę odpowiedzianych rund (1-9) do podglądu u rywali i nie odnawia limitu.

const A = "ania";
const B = "bartek";
const C = "celina";

const result = (answers: number[]): Move => ({ type: "result", answers });
const progress = (done: number): Move => ({ type: "progress", done });
const angles = (s: State) => s.rounds.map((r) => r.angle);
/** Odpowiedzi z błędem `d` w każdej rundzie, na przemian w górę i w dół (kąty 5-175, więc d ≤ 5 mieści się w zakresie). */
const off = (s: State, d: number) => angles(s).map((a, i) => (i % 2 ? a + d : a - d));

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje ruch`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

test("definicja: 1-6 graczy, limit 120 s, świeża gra trwa", () => {
  expect([game.minPlayers, game.maxPlayers, game.turnSeconds]).toEqual([1, 6, 120]);
  const s = game.setup([A, B], createRng(1));
  expect(game.isOver(s)).toBeNull();
  expect(game.waitingFor(s)).toEqual([A, B]);
});

test("10 rund, kąty 5-175 i obrót 0-359 w całych stopniach, rewanż ma inne wyzwanie", () => {
  expect([ROUNDS, MIN, MAX, MAX_ANSWER]).toEqual([10, 5, 175, 180]);
  const seen = new Set<number>();
  for (let seed = 1; seed <= 50; seed++) {
    const s = game.setup([A, B], createRng(seed));
    expect(s.rounds).toHaveLength(ROUNDS);
    for (const { angle, rotation } of s.rounds) {
      expect(Number.isInteger(angle) && angle >= MIN && angle <= MAX, `kąt ${angle}`).toBe(true);
      expect(Number.isInteger(rotation) && rotation >= 0 && rotation <= 359, `obrót ${rotation}`).toBe(true);
      seen.add(angle);
    }
  }
  // Ostre i rozwarte: losowanie pokrywa cały zakres, nie tylko jego część.
  expect(Math.min(...seen)).toBeLessThan(20);
  expect(Math.max(...seen)).toBeGreaterThan(160);
  expect(game.setup([A, B], createRng(1))).toEqual(game.setup([A, B], createRng(1)));
  expect(game.setup([A, B], createRng(2)).rounds).not.toEqual(game.setup([A, B], createRng(1)).rounds);
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  const ok = angles(s);
  test.each([
    ["za mało", ok.slice(0, 9)],
    ["za dużo", [...ok, 90]],
    ["ujemne", [...ok.slice(0, 9), -1]],
    ["181", [...ok.slice(0, 9), 181]],
    ["ułamek", [...ok.slice(0, 9), 45.5]],
  ])("odrzucone: %s", (_, answers) => expect(game.validateMove(s, A, result(answers))).toBe(false));
  test("0 i 180 przechodzą", () => {
    expect(game.validateMove(s, A, result([...ok.slice(0, 9), 0]))).toBe(true);
    expect(game.validateMove(s, A, result([...ok.slice(0, 9), 180]))).toBe(true);
  });
  test("obcy gracz", () => expect(game.validateMove(s, C, result(ok))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(ok)), A, result(ok))).toBe(false));
  test("po końcu gry", () => {
    const over = send(send(s, A, result(ok)), B, result(ok));
    expect(game.validateMove(over, A, result(ok))).toBe(false);
    expect(game.validateMove(over, B, progress(3))).toBe(false);
  });
  test("pusta odpowiedź", () => expect(game.validateMove(s, A, result([]))).toBe(true));
});

describe("wynik i koniec", () => {
  test("bezbłędnie = 0, pusta lista = najgorszy możliwy błąd w każdej rundzie, odpowiedzi zostają w stanie", () => {
    let s = game.setup([A, B], createRng(1));
    const worst = angles(s).map((a) => Math.max(a, MAX_ANSWER - a));
    s = send(s, A, result(angles(s)));
    s = send(s, B, result([]));
    expect(s.results).toEqual({ [A]: 0, [B]: worst.reduce((a, b) => a + b, 0) });
    expect(s.answers).toEqual({ [A]: angles(s), [B]: [] });
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test("żadna odpowiedź nie jest gorsza od limitu czasu", () => {
    const s = game.setup([A, B], createRng(1));
    const timeout = send(s, A, result([])).results[A];
    for (const answers of [Array(ROUNDS).fill(0), Array(ROUNDS).fill(MAX_ANSWER)]) {
      expect(send(s, A, result(answers)).results[A]).toBeLessThanOrEqual(timeout);
    }
  });

  test.each([
    [A, [1, 2, 3], [A, B, C]],
    [B, [3, 1, 2], [B, C, A]],
    [C, [2, 3, 1], [C, A, B]],
  ])("błędy w obie strony się sumują, mniejsza suma wygrywa (%s)", (winner, [a, b, c], ranking) => {
    let s = game.setup([A, B, C], createRng(1));
    s = send(s, A, result(off(s, a)));
    expect(game.isOver(s)).toBeNull();
    expect(game.waitingFor(s)).toEqual([B, C]);
    s = send(s, B, result(off(s, b)));
    s = send(s, C, result(off(s, c)));
    expect(s.results).toEqual({ [A]: a * ROUNDS, [B]: b * ROUNDS, [C]: c * ROUNDS });
    expect(game.isOver(s)).toEqual({ winner, ranking });
  });

  test("remis: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(off(s, 2)));
    s = send(s, B, result(off(s, -2)));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("gra solo kończy się rankingiem bez zwycięzcy", () => {
    const s = game.setup([A], createRng(1));
    expect(game.isOver(send(s, A, result(angles(s))))).toEqual({ ranking: [A] });
  });

  test("po limicie czasu pusta odpowiedź, która przechodzi walidację", () => {
    const s = game.setup([A, B], createRng(1));
    const move = game.timeoutMove!(s, A, createRng(1));
    expect(move).toEqual(result([]));
    expect(game.validateMove(s, A, move)).toBe(true);
  });

  test("applyMove nie zmienia poprzedniego stanu, stan przeżywa JSON", () => {
    const s = game.setup([A, B], createRng(1));
    const before = JSON.stringify(s);
    const after = send(send(s, A, progress(4)), A, result(angles(s)));
    expect(JSON.stringify(s)).toBe(before);
    expect(JSON.parse(JSON.stringify(after))).toEqual(after);
  });
});

describe("postęp", () => {
  const s = game.setup([A, B], createRng(1));

  test("na starcie pusty, po zgłoszeniu widzą go wszyscy", () => {
    expect((game.playerView(s, B) as View).progress).toEqual({});
    const after = send(s, A, progress(3));
    expect((game.playerView(after, B) as View).progress).toEqual({ [A]: 3 });
    expect((game.playerView(after, "") as View).progress).toEqual({ [A]: 3 });
    expect(s.progress).toEqual({});
  });

  test("nie kończy gry i nie zmienia, na kogo czekamy", () => {
    const after = send(s, A, progress(ROUNDS - 1));
    expect(game.isOver(after)).toBeNull();
    expect(game.waitingFor(after)).toEqual([A, B]);
    expect(game.validateMove(after, A, result(angles(s)))).toBe(true);
  });

  test("może spaść (gracz odświeżył stronę i zaczyna od nowa)", () => {
    expect(send(send(s, A, progress(5)), A, progress(1)).progress[A]).toBe(1);
  });

  test.each([
    ["zero", progress(0)],
    ["ostatnia runda (to już wynik)", progress(ROUNDS)],
    ["ułamek", progress(1.5)],
  ])("odrzucony: %s", (_, move) => expect(game.validateMove(s, A, move)).toBe(false));
  test("obcy gracz", () => expect(game.validateMove(s, C, progress(3))).toBe(false));
  test("po oddaniu wyniku", () => expect(game.validateMove(send(s, A, result(angles(s))), A, progress(3))).toBe(false));

  test("limit tury ma stały klucz, więc postęp go nie odnawia", () => {
    expect(game.turn!(s)).toEqual({ key: "run", seconds: game.turnSeconds });
    expect(game.turn!(send(s, A, progress(5)))).toEqual(game.turn!(s));
  });

  test("schemat odrzuca śmieci z sieci", () => {
    const ok = (m: unknown) => game.moveSchema.safeParse(m).success;
    expect(ok(progress(3))).toBe(true);
    expect(ok(result([]))).toBe(true);
    expect(ok({ type: "progress" })).toBe(false);
    expect(ok({ type: "progress", done: "3" })).toBe(false);
    expect(ok({ type: "result" })).toBe(false);
    expect(ok({ type: "result", answers: ["90"] })).toBe(false);
    expect(ok({ type: "result", answers: Array(ROUNDS + 1).fill(1) })).toBe(false);
    expect(ok({ type: "skok" })).toBe(false);
  });
});
