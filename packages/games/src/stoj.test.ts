import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { DURATION_MS, type Move, SCHEDULE, score, type State, stoj as game, type View } from "./stoj.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy grają naraz u siebie; harmonogram bodźców jest stały (odstęp maleje z 1000 do 500 ms, razem najwyżej 30 s),
//   losowe jest tylko to, które bodźce są czerwone (dokładnie co trzeci, ta sama kolejność dla wszystkich),
// - klient oddaje jeden wynik: czas reakcji na każdy bodziec (100 ms do odstępu bodźca) albo null,
// - serwer liczy trafienia (dotknięte zielone) i błędy (dotknięte czerwone); wynik = trafienia − 2 × błędy, nie mniej niż 0,
// - ranking: więcej punktów wyżej, przy równych niższa średnia reakcji; zwycięzca tylko przy 2+ graczach i bez remisu.

const A = "ania";
const B = "bartek";
const C = "celina";
const N = SCHEDULE.length;

const view = (s: State, player = A) => game.playerView(s, player) as View;
const fresh = (players = [A, B], seed = 1) => game.setup(players, createRng(seed));

/** Wynik gracza, który dotknął pierwszych `hits` zielonych i pierwszych `errors` czerwonych, zawsze po `ms`. */
function play(s: State, hits: number, errors = 0, ms = 300): Move {
  let greens = 0;
  let reds = 0;
  return { type: "result", taps: view(s).reds.map((red) => ((red ? reds++ < errors : greens++ < hits) ? ms : null)) };
}

/** Jedno dotknięcie bodźca `i` po `ms`. */
const tap = (i: number, ms: number): Move => ({ type: "result", taps: Array.from({ length: i + 1 }, (_, j) => (j === i ? ms : null)) });

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
    expect([game.id, game.minPlayers, game.maxPlayers, game.turnSeconds]).toEqual(["stoj", 1, 6, 60]);
    expect(game.isOver(fresh())).toBeNull();
  });
});

describe("harmonogram", () => {
  test("pierwszy bodziec od razu, każdy następny po odstępie poprzedniego", () => {
    expect(SCHEDULE[0].at).toBe(0);
    SCHEDULE.slice(1).forEach((s, i) => expect(s.at).toBe(SCHEDULE[i].at + SCHEDULE[i].window));
  });

  test("tempo rośnie: odstęp maleje z 1000 ms i nie schodzi poniżej 500 ms", () => {
    expect(SCHEDULE[0].window).toBe(1000);
    SCHEDULE.slice(1).forEach((s, i) => expect(s.window).toBeLessThan(SCHEDULE[i].window));
    expect(SCHEDULE[N - 1].window).toBeGreaterThanOrEqual(500);
    expect(SCHEDULE[N - 1].window).toBeLessThan(600);
  });

  test("ostatni bodziec kończy się przed upływem 30 s", () => {
    expect(DURATION_MS).toBe(30_000);
    expect(SCHEDULE[N - 1].at + SCHEDULE[N - 1].window).toBeLessThanOrEqual(DURATION_MS);
    expect(N).toBeGreaterThanOrEqual(35);
  });
});

describe("setup", () => {
  test("wszyscy grają naraz i dostają tę samą kolejność bodźców", () => {
    const s = fresh();
    expect(game.waitingFor(s)).toEqual([A, B]);
    expect(view(s, A).reds).toEqual(view(s, B).reds);
    expect(view(s, "").reds).toEqual(view(s, A).reds);
  });

  test("dokładnie co trzeci bodziec jest czerwony", () => {
    for (const seed of [1, 2, 3]) {
      const { reds } = view(fresh([A], seed));
      expect(reds).toHaveLength(N);
      expect(reds.filter(Boolean)).toHaveLength(Math.round(N / 3));
    }
  });

  test("ten sam seed to ta sama kolejność, rewanż daje inną", () => {
    expect(view(fresh([A], 1)).reds).toEqual(view(fresh([A], 1)).reds);
    expect(view(fresh([A], 1)).reds).not.toEqual(view(fresh([A], 2)).reds);
  });
});

describe("walidacja", () => {
  const s = fresh();
  const last = N - 1;

  test("obcy gracz", () => expect(accepts(s, C, play(s, 3))).toBe(false));
  test("drugi wynik tego samego gracza", () => expect(accepts(send(s, A, play(s, 3)), A, play(s, 4))).toBe(false));
  test("wynik po końcu gry", () => {
    const over = send(send(s, A, play(s, 3)), B, play(s, 4));
    expect(accepts(over, A, play(s, 5))).toBe(false);
  });

  test("reakcja od 100 ms, szybsza to zgadywanie", () => {
    expect(accepts(s, A, tap(0, 99))).toBe(false);
    expect(accepts(s, A, tap(0, 100))).toBe(true);
  });

  test("reakcja najpóźniej do pojawienia się następnego bodźca", () => {
    for (const i of [0, last]) {
      expect(accepts(s, A, tap(i, SCHEDULE[i].window))).toBe(true);
      expect(accepts(s, A, tap(i, SCHEDULE[i].window + 1))).toBe(false);
    }
  });

  test("najwyżej tyle reakcji, ile bodźców", () => {
    expect(accepts(s, A, { type: "result", taps: Array(N).fill(null) })).toBe(true);
    expect(accepts(s, A, { type: "result", taps: Array(N + 1).fill(null) })).toBe(false);
  });

  test.each([
    ["czas niecałkowity", { type: "result", taps: [300.5] }],
    ["czas tekstem", { type: "result", taps: ["300"] }],
    ["brak listy", { type: "result" }],
    ["lista nie jest listą", { type: "result", taps: 300 }],
    ["zły typ ruchu", { type: "progress", taps: [] }],
  ])("schemat odrzuca: %s", (_, move) => {
    expect(game.moveSchema.safeParse(move).success).toBe(false);
  });
});

describe("wynik", () => {
  const s = fresh();
  const result = (move: Move) => view(send(s, A, move)).results[A];

  test("dotknięty zielony to trafienie z czasem reakcji", () => {
    const r = result(play(s, 5, 0, 250));
    expect(r).toEqual({ times: [250, 250, 250, 250, 250], errors: 0 });
    expect(score(r)).toBe(5);
  });

  test("dotknięty czerwony to błąd i kosztuje 2 punkty", () => {
    const r = result(play(s, 10, 3));
    expect(r.errors).toBe(3);
    expect(r.times).toHaveLength(10);
    expect(score(r)).toBe(4);
  });

  test("wynik nie spada poniżej zera", () => {
    expect(score(result(play(s, 1, 4)))).toBe(0);
    expect(score(result(play(s, 0, 1)))).toBe(0);
  });

  test("przepuszczony zielony nic nie kosztuje", () => {
    expect(score(result(play(s, 7)))).toBe(7);
  });

  test("klepanie na oślep nie daje więcej niż 2 punkty", () => {
    expect(score(result(play(s, N, N)))).toBeLessThanOrEqual(2);
  });

  test("krótsza lista: brakujące bodźce to brak dotknięcia", () => {
    const green = view(s).reds.indexOf(false);
    expect(result(tap(green, 400))).toEqual({ times: [400], errors: 0 });
  });
});

describe("koniec", () => {
  test("gra trwa, dopóki ktoś nie oddał wyniku", () => {
    const s0 = fresh();
    const s = send(s0, A, play(s0, 3));
    expect(game.waitingFor(s)).toEqual([B]);
    expect(game.isOver(s)).toBeNull();
    expect(view(s, B).results[A].times).toHaveLength(3);
  });

  test("więcej punktów wygrywa, przy równych niższa średnia reakcji", () => {
    let s = fresh([A, B, C]);
    s = send(s, A, play(s, 6, 0, 400));
    s = send(s, B, play(s, 10, 1, 500));
    s = send(s, C, play(s, 6, 0, 300));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test.each([A, B, C])("wygrać może każdy: %s", (best) => {
    let s = fresh([A, B, C]);
    for (const p of [A, B, C]) s = send(s, p, play(s, p === best ? 9 : 4, 0, p === A ? 300 : p === B ? 310 : 320));
    expect(game.isOver(s)?.winner).toBe(best);
  });

  test("te same punkty i średnia: remis bez zwycięzcy", () => {
    let s = fresh();
    s = send(s, A, play(s, 5));
    s = send(s, B, play(s, 9, 2));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("nikt nie trafił (limit czasu albo same błędy): remis bez zwycięzcy", () => {
    let s = fresh();
    s = send(s, A, game.timeoutMove!(s, A, createRng(1)));
    s = send(s, B, play(s, 0, 2));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("zero punktów z trafieniami jest wyżej niż zero bez trafień", () => {
    let s = fresh();
    s = send(s, A, game.timeoutMove!(s, A, createRng(1)));
    s = send(s, B, play(s, 2, 1));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A] });
  });

  test("solo: bez zwycięzcy", () => {
    const s = fresh([A]);
    expect(game.isOver(send(s, A, play(s, 8)))).toEqual({ ranking: [A] });
  });

  test("po limicie czasu pusty wynik, czyli zero punktów", () => {
    const s = fresh();
    const move = game.timeoutMove!(s, A, createRng(1));
    expect(move).toEqual({ type: "result", taps: [] });
    expect(score(view(send(s, A, move)).results[A])).toBe(0);
  });
});

describe("stan", () => {
  test("oddanie wyniku nie zmienia poprzedniego stanu, a stan przeżywa JSON", () => {
    const s = fresh();
    const before = JSON.stringify(s);
    const next = send(s, A, play(s, 4, 1));
    expect(JSON.stringify(s)).toBe(before);
    const copy = JSON.parse(JSON.stringify(next)) as State;
    expect(copy).toEqual(next);
    expect(game.isOver(send(copy, B, play(copy, 3)))).toEqual({ winner: B, ranking: [B, A] });
  });
});
