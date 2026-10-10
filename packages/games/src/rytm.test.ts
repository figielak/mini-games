import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { BEATS, deviation, expected, MAX_TAPS, type Move, rytm as game, type State, TAP_MS, type View } from "./rytm.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy grają naraz u siebie; metronom gra 8 uderzeń i cichnie, gracz stuka dalej przez 10 s,
// - tempo losuje serwer: 70-130 BPM co 5, w stanie jako odstęp w ms, to samo dla wszystkich,
// - klient oddaje jeden wynik: czasy stuknięć w ms od ostatniego uderzenia metronomu (1-10 000, ściśle rosnące, najwyżej 60),
// - serwer liczy średnią odchyłkę odstępów od odstępu metronomu (pierwszy odstęp od ostatniego uderzenia); błąd odstępu
//   jest ucięty do odstępu metronomu, a brakujące odstępy (do floor(10 000 / odstęp) − 1) liczą się jak najgorsze,
// - mniejsza odchyłka wyżej; zwycięzca tylko przy 2+ graczach i bez remisu; po limicie czasu najgorszy wynik (odstęp metronomu).

const A = "ania";
const B = "bartek";
const C = "celina";

const view = (s: State, player = A) => game.playerView(s, player) as View;
const fresh = (players = [A, B], seed = 1) => game.setup(players, createRng(seed));

/** `n` stuknięć w równych odstępach, każdy o `offset` ms dłuższy niż odstęp metronomu. */
const steady = (interval: number, offset = 0, n = expected(interval)) => Array.from({ length: n }, (_, i) => (i + 1) * (interval + offset));
const result = (taps: number[]): Move => ({ type: "result", taps });
/** Wynik gracza, który trzyma tempo z odstępami o `offset` ms za długimi (dodatni najwyżej 20, inaczej ostatnie stuknięcia wypadają za 10 s). */
const play = (s: State, offset = 0) => result(steady(s.interval, offset));

/** Tak ruch widzi platforma: najpierw kształt, potem reguły. */
const accepts = (s: State, player: string, move: unknown) => {
  const parsed = game.moveSchema.safeParse(move);
  return parsed.success && game.validateMove(s, player, parsed.data);
};

function send(s: State, player: string, move: Move): State {
  expect(accepts(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

describe("definicja", () => {
  test("1-6 graczy, limit 60 s, świeża gra trwa", () => {
    expect([game.id, game.minPlayers, game.maxPlayers, game.turnSeconds]).toEqual(["rytm", 1, 6, 60]);
    expect(game.isOver(fresh())).toBeNull();
  });

  test("metronom gra 8 uderzeń, stukanie trwa 10 s", () => expect([BEATS, TAP_MS]).toEqual([8, 10_000]));
});

describe("setup", () => {
  test("tempo to 70-130 BPM co 5 i trafiają się wszystkie", () => {
    const intervals = new Set(Array.from({ length: 300 }, (_, seed) => fresh([A], seed).interval));
    const bpms = Array.from({ length: 13 }, (_, i) => 70 + 5 * i);
    expect([...intervals].sort((a, b) => a - b)).toEqual(bpms.map((bpm) => Math.round(60_000 / bpm)).sort((a, b) => a - b));
  });

  test("wszyscy grają naraz i dostają to samo tempo", () => {
    const s = fresh();
    expect(game.waitingFor(s)).toEqual([A, B]);
    expect(view(s, B).interval).toBe(view(s, A).interval);
    expect(view(s, "").interval).toBe(view(s, A).interval);
  });

  test("ten sam seed to ta sama partia, rewanż ma inne wyzwanie", () => {
    expect(fresh([A], 1)).toEqual(fresh([A], 1));
    expect(fresh([A], 2).nonce).not.toBe(fresh([A], 1).nonce);
  });
});

describe("odchyłka", () => {
  // Skrajne tempa: 130 i 70 BPM.
  const FAST = 462;
  const SLOW = 857;

  test("oczekiwana liczba odstępów: tyle, ile mieści się w 10 s, minus jedno uderzenie zapasu", () => {
    expect(expected(FAST)).toBe(20);
    expect(expected(SLOW)).toBe(10);
    expect(expected(500)).toBe(19);
  });

  test.each([FAST, SLOW])("idealne stukanie co %i ms to 0", (i) => expect(deviation(i, steady(i))).toBe(0));

  test.each([-20, 20])("odstępy stale o %i ms inne niż metronomu to 20", (offset) => {
    expect(deviation(FAST, steady(FAST, offset))).toBe(20);
    expect(deviation(SLOW, steady(SLOW, offset))).toBe(20);
  });

  test("pierwszy odstęp liczy się od ostatniego uderzenia metronomu", () => {
    const n = expected(SLOW);
    const late = steady(SLOW).map((t) => t + 100);
    expect(deviation(SLOW, late)).toBe(Math.round(100 / n));
  });

  test("pominięte uderzenie to jeden odstęp z pełnym błędem", () => {
    const n = expected(SLOW);
    const skipped = steady(SLOW, 0, n + 1).filter((_, i) => i !== 3);
    expect(deviation(SLOW, skipped)).toBe(Math.round(SLOW / n));
  });

  test("błąd odstępu jest ucięty do odstępu metronomu", () => {
    expect(deviation(SLOW, [SLOW, 5 * SLOW])).toBe(deviation(SLOW, [SLOW, 3 * SLOW]));
  });

  test("za mało stuknięć: każdy brakujący odstęp liczy się jak najgorszy", () => {
    const n = expected(FAST);
    expect(deviation(FAST, steady(FAST, 0, n - 2))).toBe(Math.round((2 * FAST) / n));
    expect(deviation(FAST, steady(FAST, 0, 2))).toBe(Math.round(((n - 2) * FAST) / n));
  });

  test("więcej stuknięć niż oczekiwano: liczą się wszystkie odstępy", () => {
    const n = expected(SLOW);
    const taps = [...steady(SLOW), (n + 1) * SLOW - 60];
    expect(taps.at(-1)).toBeLessThanOrEqual(TAP_MS);
    expect(deviation(SLOW, taps)).toBe(Math.round(60 / (n + 1)));
  });

  test("brak stuknięć to najgorszy wynik: odstęp metronomu", () => {
    expect(deviation(FAST, [])).toBe(FAST);
    expect(deviation(SLOW, [])).toBe(SLOW);
  });

  test.each([FAST, SLOW])("klepanie na oślep przy odstępie %i ms jest prawie tak złe jak brak stuknięć", (i) => {
    const mash = steady(50, 0, MAX_TAPS);
    expect(deviation(i, mash)).toBeGreaterThan(0.8 * i);
    expect(deviation(i, mash)).toBeLessThanOrEqual(i);
  });
});

describe("walidacja", () => {
  const s = fresh();

  test("obcy gracz", () => expect(accepts(s, C, play(s))).toBe(false));
  test("drugi wynik tego samego gracza", () => expect(accepts(send(s, A, play(s)), A, play(s, 5))).toBe(false));
  test("wynik po końcu gry", () => {
    const over = send(send(s, A, play(s)), B, play(s, 5));
    expect(accepts(over, A, play(s))).toBe(false);
  });

  test("stuknięcie od 1 ms do 10 s po ostatnim uderzeniu", () => {
    expect(accepts(s, A, result([0]))).toBe(false);
    expect(accepts(s, A, result([1]))).toBe(true);
    expect(accepts(s, A, result([TAP_MS]))).toBe(true);
    expect(accepts(s, A, result([TAP_MS + 1]))).toBe(false);
  });

  test("czasy muszą ściśle rosnąć", () => {
    expect(accepts(s, A, result([500, 500]))).toBe(false);
    expect(accepts(s, A, result([500, 400]))).toBe(false);
    expect(accepts(s, A, result([500, 501]))).toBe(true);
  });

  test("najwyżej 60 stuknięć", () => {
    expect(MAX_TAPS).toBe(60);
    expect(accepts(s, A, result(steady(100, 0, MAX_TAPS)))).toBe(true);
    expect(accepts(s, A, result(steady(100, 0, MAX_TAPS + 1)))).toBe(false);
  });

  test.each([
    ["czas niecałkowity", { type: "result", taps: [500.5] }],
    ["czas tekstem", { type: "result", taps: ["500"] }],
    ["brak listy", { type: "result" }],
    ["lista nie jest listą", { type: "result", taps: 500 }],
    ["zły typ ruchu", { type: "progress", taps: [] }],
  ])("schemat odrzuca: %s", (_, move) => {
    expect(game.moveSchema.safeParse(move).success).toBe(false);
  });
});

describe("koniec", () => {
  test("wynik gracza to odchyłka policzona przez serwer", () => {
    const s0 = fresh();
    const s = send(s0, A, play(s0, -30));
    expect(game.waitingFor(s)).toEqual([B]);
    expect(game.isOver(s)).toBeNull();
    expect(view(s, B).results[A]).toBe(30);
  });

  test("mniejsza odchyłka wygrywa", () => {
    let s = fresh([A, B, C]);
    s = send(s, A, play(s, -40));
    s = send(s, B, play(s, -10));
    s = send(s, C, play(s, -25));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test.each([A, B, C])("wygrać może każdy: %s", (best) => {
    let s = fresh([A, B, C]);
    for (const p of [A, B, C]) s = send(s, p, play(s, p === best ? 5 : -30));
    expect(game.isOver(s)?.winner).toBe(best);
  });

  test("ta sama odchyłka: remis bez zwycięzcy, także gdy jeden grał za szybko, a drugi za wolno", () => {
    let s = fresh();
    s = send(s, A, play(s, 15));
    s = send(s, B, play(s, -15));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("solo: bez zwycięzcy", () => {
    const s = fresh([A]);
    expect(game.isOver(send(s, A, play(s)))).toEqual({ ranking: [A] });
  });

  test("po limicie czasu najgorszy wynik: odstęp metronomu", () => {
    let s = fresh();
    const move = game.timeoutMove!(s, A, createRng(1));
    expect(move).toEqual({ type: "result", taps: [] });
    s = send(s, A, move);
    expect(view(s).results[A]).toBe(s.interval);
    expect(game.isOver(send(s, B, play(s, -200)))).toEqual({ winner: B, ranking: [B, A] });
  });
});

describe("stan", () => {
  test("oddanie wyniku nie zmienia poprzedniego stanu, a stan przeżywa JSON", () => {
    const s = fresh();
    const before = JSON.stringify(s);
    const next = send(s, A, play(s, 20));
    expect(JSON.stringify(s)).toBe(before);
    const copy = JSON.parse(JSON.stringify(next)) as State;
    expect(copy).toEqual(next);
    expect(game.isOver(send(copy, B, play(copy, 10)))).toEqual({ winner: B, ranking: [B, A] });
  });
});
