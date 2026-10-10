import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { type Move, PENALTY_MS, schulte as game, type State, type View } from "./schulte.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - wszyscy dostają tę samą siatkę 5×5 z liczbami 1-25 w losowej kolejności,
// - klient oddaje czas (ms) i liczbę pomyłek; każda pomyłka to 3 s kary,
// - czas krótszy niż 25 × 150 ms jest nierealny, dłuższy niż limit tury też,
// - ranking po czasie z karami rosnąco; po limicie czasu ostatnie miejsce,
// - mini-gra ma zasady narzucone z góry: bez trybów, znalezione liczby zostają widoczne,
// - wynik niesie 25 międzyczasów (suma równa czasowi) albo pustą listę; nie wpływają na ranking,
// - po każdym trafieniu klient zgłasza postęp (1-24), który widzą rywale; postęp nie kończy gry i nie odnawia limitu.

const A = "ania";
const B = "bartek";
const C = "celina";

/** Równe międzyczasy, reszta z dzielenia w ostatnim. */
const even = (ms: number) => Array.from({ length: 25 }, (_, i) => Math.floor(ms / 25) + (i === 24 ? ms % 25 : 0));
const result = (ms: number, mistakes = 0, splits = even(ms)): Move => ({ type: "result", ms, mistakes, splits });
const progress = (found: number): Move => ({ type: "progress", found });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

test("siatka to permutacja 1-25, wspólna dla wszystkich", () => {
  const s = game.setup([A, B], createRng(1));
  const { grid } = game.playerView(s, A) as View;
  expect([...grid].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  expect(grid).not.toEqual([...grid].sort((a, b) => a - b));
  expect(game.waitingFor(s)).toEqual([A, B]);
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  test.each([
    ["za szybko", result(3749)],
    ["po limicie tury", result(game.turnSeconds! * 1000 + 1)],
    ["ujemne pomyłki", result(20_000, -1)],
    ["ułamek pomyłki", result(20_000, 0.5)],
  ])("%s", (_, move) => expect(game.validateMove(s, A, move)).toBe(false));
  test("obcy gracz", () => expect(game.validateMove(s, C, result(20_000))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(20_000)), A, result(19_000))).toBe(false));
});

describe("koniec", () => {
  test("pomyłki doliczają karę", () => {
    expect(PENALTY_MS).toBe(3000);
    let s = game.setup([A, B, C], createRng(1));
    s = send(s, A, result(20_000, 2)); // 26 s
    s = send(s, B, result(24_000)); // 24 s
    expect(game.isOver(s)).toBeNull();
    s = send(s, C, result(22_000, 1)); // 25 s
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("kara wyrównuje czas: remis bez zwycięzcy; solo też", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(20_000, 1));
    s = send(s, B, result(23_000));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
    expect(game.isOver(send(game.setup([A], createRng(1)), A, result(20_000)))).toEqual({ ranking: [A] });
  });

  test("granice czasu: najkrótszy i najdłuższy dozwolony", () => {
    const s = game.setup([A, B], createRng(1));
    expect(game.validateMove(s, A, result(3750))).toBe(true);
    expect(game.validateMove(s, A, result(game.turnSeconds! * 1000))).toBe(true);
  });

  test("po limicie czasu ostatnie miejsce", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, game.timeoutMove!(s, A, createRng(1)));
    s = send(s, B, result(game.turnSeconds! * 1000 - 1000));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A] });
  });
});

test("gra nie ma trybów", () => {
  expect(game.modes).toBeUndefined();
  expect(game.playerView(game.setup([A, B], createRng(1), "latwa"), A)).not.toHaveProperty("mode");
});

describe("postęp", () => {
  const s = game.setup([A, B], createRng(1));

  test("na starcie pusty, po zgłoszeniu widzą go wszyscy", () => {
    expect((game.playerView(s, B) as View).progress).toEqual({});
    const after = send(s, A, progress(12));
    expect((game.playerView(after, B) as View).progress).toEqual({ [A]: 12 });
    expect((game.playerView(after, "") as View).progress).toEqual({ [A]: 12 });
  });

  test("nie kończy gry i nie zmienia, na kogo czekamy", () => {
    const after = send(s, A, progress(24));
    expect(game.isOver(after)).toBeNull();
    expect(game.waitingFor(after)).toEqual([A, B]);
    expect(game.validateMove(after, A, result(20_000))).toBe(true);
  });

  test("może spaść (gracz odświeżył stronę i zaczyna od nowa)", () => {
    expect((send(send(s, A, progress(12)), A, progress(1)) as State).progress[A]).toBe(1);
  });

  test.each([
    ["zero", progress(0)],
    ["ostatnia liczba (to już wynik)", progress(25)],
    ["ułamek", progress(1.5)],
  ])("odrzucony: %s", (_, move) => expect(game.validateMove(s, A, move)).toBe(false));
  test("obcy gracz", () => expect(game.validateMove(s, C, progress(3))).toBe(false));
  test("po oddaniu wyniku", () => expect(game.validateMove(send(s, A, result(20_000)), A, progress(3))).toBe(false));

  test("limit tury ma stały klucz, więc postęp go nie odnawia", () => {
    expect(game.turn!(s)).toEqual({ key: "run", seconds: game.turnSeconds });
    expect(game.turn!(send(s, A, progress(5)))).toEqual(game.turn!(s));
  });
});

describe("międzyczasy", () => {
  const s = game.setup([A, B], createRng(1));

  test("trafiają do widoku razem z wynikiem", () => {
    const splits = [...even(20_000).slice(0, 23), 300, 1300];
    const after = send(s, A, result(20_000, 1, splits));
    expect((game.playerView(after, B) as View).results[A]).toEqual({ ms: 20_000, mistakes: 1, splits });
  });

  test("pusta lista przechodzi; tak oddaje wynik limit czasu", () => {
    expect(game.validateMove(s, A, result(20_000, 0, []))).toBe(true);
    expect(game.timeoutMove!(s, A, createRng(1))).toMatchObject({ splits: [] });
  });

  test.each([
    ["24 czasy", even(20_000).slice(1)],
    ["suma inna niż czas", even(19_000)],
    ["ujemny czas", [-800, 1600, ...even(20_000).slice(2)]],
    ["ułamek", [800.5, 799.5, ...even(20_000).slice(2)]],
  ])("odrzucone: %s", (_, splits) => expect(game.validateMove(s, A, result(20_000, 0, splits))).toBe(false));
});
