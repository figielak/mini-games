import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { BALLS, MOVE_MS, type Move, position, RADIUS, ROUNDS, sledzenie as game, type State, TARGETS, type View } from "./sledzenie.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy grają naraz u siebie te same rundy: 8 kulek, cele to kulki o indeksach 0-2, najwyżej 20 rund,
// - kulki lecą po prostej i odbijają się od krawędzi pola; pozycja to wzór od czasu (position), tempo rośnie z każdą rundą,
//   na starcie i po zatrzymaniu kulki się nie nakładają,
// - klient oddaje jeden wynik: wskazania z kolejnych rund (po 3 różne indeksy 0-7),
// - serwer liczy rundy z kompletem celów do pierwszej pomyłki i trafione cele w rundzie z pomyłką,
// - ranking: więcej rund wyżej, przy równych więcej trafionych; zwycięzca tylko przy 2+ graczach i bez remisu.

const A = "ania";
const B = "bartek";
const C = "celina";

/** Komplet celów i pomyłki z 0, 1 i 2 trafionymi. */
const GOOD = [0, 1, 2];
const MISS = [
  [5, 6, 7],
  [0, 6, 7],
  [0, 1, 7],
];

const view = (s: State, player = A) => game.playerView(s, player) as View;
const fresh = (players = [A, B], seed = 1) => game.setup(players, createRng(seed));

/** Wynik gracza, który zaliczył `rounds` rund, a w następnej wskazał `last` (bez `last`: przerwał albo doszedł do końca). */
const play = (rounds: number, last?: number[]): Move => ({ type: "result", picks: [...Array.from({ length: rounds }, () => GOOD), ...(last ? [last] : [])] });

/** Tak ruch widzi platforma: najpierw kształt, potem reguły. */
const accepts = (s: State, player: string, move: unknown) => {
  const parsed = game.moveSchema.safeParse(move);
  return parsed.success && game.validateMove(s, player, parsed.data);
};

function send(s: State, player: string, move: Move): State {
  expect(accepts(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Prędkość kulek w rundzie (bok pola na sekundę): najdłuższy krok 10 ms, bo krok z odbiciem od ściany wychodzi krótszy. */
function speed(s: State, round: number) {
  const steps = view(s).rounds[round].flatMap((ball) => [0, 1000, 2000].map((t) => distance(position(ball, round, t), position(ball, round, t + 10))));
  return Math.max(...steps) * 100;
}

describe("definicja", () => {
  test("1-6 graczy, limit 300 s, świeża gra trwa", () => {
    expect([game.id, game.minPlayers, game.maxPlayers, game.turnSeconds]).toEqual(["sledzenie", 1, 6, 300]);
    expect(game.isOver(fresh())).toBeNull();
  });

  test("8 kulek, 3 cele, najwyżej 20 rund, ruch trwa 5 s", () => {
    expect([BALLS, TARGETS, ROUNDS, MOVE_MS]).toEqual([8, 3, 20, 5000]);
  });
});

describe("setup", () => {
  test("wszyscy grają naraz i dostają te same kulki", () => {
    const s = fresh();
    expect(game.waitingFor(s)).toEqual([A, B]);
    expect(view(s, A).rounds).toEqual(view(s, B).rounds);
    expect(view(s, "").rounds).toEqual(view(s, A).rounds);
  });

  test("20 rund po 8 kulek", () => {
    const { rounds } = view(fresh());
    expect(rounds).toHaveLength(ROUNDS);
    for (const balls of rounds) expect(balls).toHaveLength(BALLS);
  });

  test("ten sam seed to te same kulki, rewanż daje inne", () => {
    expect(view(fresh([A], 1)).rounds).toEqual(view(fresh([A], 1)).rounds);
    expect(view(fresh([A], 1)).rounds).not.toEqual(view(fresh([A], 2)).rounds);
  });
});

describe("ruch kulek", () => {
  const games = [1, 2, 3].map((seed) => view(fresh([A], seed)).rounds);

  test("kulka startuje ze swojej wylosowanej pozycji", () => {
    for (const rounds of games) {
      rounds.forEach((balls, r) => balls.forEach((ball) => expect(position(ball, r, 0)).toEqual({ x: ball.x, y: ball.y })));
    }
  });

  test("kulka nigdy nie wychodzi poza pole (odbija się od krawędzi)", () => {
    for (const rounds of games) {
      rounds.forEach((balls, r) => {
        for (const ball of balls) {
          for (let t = 0; t <= MOVE_MS; t += 50) {
            const { x, y } = position(ball, r, t);
            for (const v of [x, y]) {
              expect(v).toBeGreaterThanOrEqual(RADIUS - 1e-9);
              expect(v).toBeLessThanOrEqual(1 - RADIUS + 1e-9);
            }
          }
        }
      });
    }
  });

  test.each([
    ["na starcie", 0],
    ["po zatrzymaniu", MOVE_MS],
  ])("kulki nie nakładają się %s", (_, t) => {
    for (const rounds of games) {
      rounds.forEach((balls, r) => {
        const at = balls.map((ball) => position(ball, r, t));
        at.forEach((a, i) => at.slice(i + 1).forEach((b) => expect(distance(a, b)).toBeGreaterThan(2 * RADIUS)));
      });
    }
  });

  test("każda kulka się rusza", () => {
    const s = fresh();
    view(s).rounds.forEach((balls, r) => balls.forEach((ball) => expect(distance(position(ball, r, 0), position(ball, r, 10))).toBeGreaterThan(0)));
  });

  test("z każdą rundą ruch jest szybszy", () => {
    const s = fresh();
    for (let r = 1; r < ROUNDS; r++) expect(speed(s, r)).toBeGreaterThan(speed(s, r - 1));
  });

  test("pierwsza runda 0,3 boku na sekundę, każda następna o 0,06 więcej", () => {
    const s = fresh();
    expect(speed(s, 0)).toBeCloseTo(0.3, 5);
    expect(speed(s, 1)).toBeCloseTo(0.36, 5);
    expect(speed(s, ROUNDS - 1)).toBeCloseTo(0.3 + 0.06 * (ROUNDS - 1), 5);
  });
});

describe("walidacja", () => {
  const s = fresh();
  const one = (picks: number[]): Move => ({ type: "result", picks: [picks] });

  test("obcy gracz", () => expect(accepts(s, C, play(3))).toBe(false));
  test("drugi wynik tego samego gracza", () => expect(accepts(send(s, A, play(3)), A, play(4))).toBe(false));
  test("wynik po końcu gry", () => {
    const over = send(send(s, A, play(3)), B, play(4));
    expect(accepts(over, A, play(5))).toBe(false);
  });

  test("w rundzie dokładnie 3 wskazania", () => {
    expect(accepts(s, A, one([0, 1]))).toBe(false);
    expect(accepts(s, A, one([0, 1, 2, 3]))).toBe(false);
    expect(accepts(s, A, one([0, 1, 2]))).toBe(true);
  });

  test("ta sama kulka wskazana dwa razy", () => expect(accepts(s, A, one([0, 0, 1]))).toBe(false));

  test("indeks kulki od 0 do 7", () => {
    expect(accepts(s, A, one([-1, 0, 1]))).toBe(false);
    expect(accepts(s, A, one([0, 1, BALLS]))).toBe(false);
    expect(accepts(s, A, one([0, 1, BALLS - 1]))).toBe(true);
  });

  test("najwyżej tyle rund, ile jest w partii", () => {
    expect(accepts(s, A, play(ROUNDS))).toBe(true);
    expect(accepts(s, A, play(ROUNDS + 1))).toBe(false);
  });

  test.each([
    ["indeks niecałkowity", { type: "result", picks: [[0.5, 1, 2]] }],
    ["indeks tekstem", { type: "result", picks: [["0", 1, 2]] }],
    ["runda nie jest listą", { type: "result", picks: [0, 1, 2] }],
    ["brak listy", { type: "result" }],
    ["lista nie jest listą", { type: "result", picks: 3 }],
    ["zły typ ruchu", { type: "progress", picks: [] }],
  ])("schemat odrzuca: %s", (_, move) => {
    expect(game.moveSchema.safeParse(move).success).toBe(false);
  });
});

describe("wynik", () => {
  const s = fresh();
  const result = (move: Move) => view(send(s, A, move)).results[A];

  test("runda z kompletem celów jest zaliczona, kolejność wskazań bez znaczenia", () => {
    expect(result({ type: "result", picks: [[2, 0, 1], [1, 2, 0]] })).toEqual({ rounds: 2, hits: 0 });
  });

  test("pierwsza pomyłka kończy liczenie", () => {
    expect(result(play(3, MISS[0]))).toEqual({ rounds: 3, hits: 0 });
    expect(result(play(0, MISS[0]))).toEqual({ rounds: 0, hits: 0 });
  });

  test.each([0, 1, 2])("w rundzie z pomyłką liczą się trafione cele: %i", (hits) => {
    expect(result(play(4, MISS[hits]))).toEqual({ rounds: 4, hits });
  });

  test("rundy po pomyłce są ignorowane", () => {
    expect(result({ type: "result", picks: [GOOD, MISS[1], GOOD, GOOD, MISS[2]] })).toEqual({ rounds: 1, hits: 1 });
  });

  test("wszystkie 20 rund bez pomyłki", () => {
    expect(result(play(ROUNDS))).toEqual({ rounds: ROUNDS, hits: 0 });
  });
});

describe("koniec", () => {
  test("gra trwa, dopóki ktoś nie oddał wyniku", () => {
    const s = send(fresh(), A, play(3, MISS[0]));
    expect(game.waitingFor(s)).toEqual([B]);
    expect(game.isOver(s)).toBeNull();
    expect(view(s, B).results[A].rounds).toBe(3);
  });

  test("więcej rund wygrywa, przy równych więcej trafionych w rundzie z pomyłką", () => {
    let s = fresh([A, B, C]);
    s = send(s, A, play(4, MISS[0]));
    s = send(s, B, play(6, MISS[0]));
    s = send(s, C, play(4, MISS[2]));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test.each([A, B, C])("wygrać może każdy: %s", (best) => {
    let s = fresh([A, B, C]);
    for (const p of [A, B, C]) s = send(s, p, play(p === best ? 9 : 4, MISS[0]));
    expect(game.isOver(s)?.winner).toBe(best);
  });

  test("te same rundy i trafione: remis bez zwycięzcy", () => {
    let s = fresh();
    s = send(s, A, play(5, MISS[1]));
    s = send(s, B, play(5, MISS[1]));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("obaj doszli do końca: remis bez zwycięzcy", () => {
    let s = fresh();
    s = send(s, A, play(ROUNDS));
    s = send(s, B, play(ROUNDS));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("solo: bez zwycięzcy", () => {
    expect(game.isOver(send(fresh([A]), A, play(8, MISS[0])))).toEqual({ ranking: [A] });
  });

  test("po limicie czasu pusty wynik, czyli zero rund", () => {
    const s = fresh();
    const move = game.timeoutMove!(s, A, createRng(1));
    expect(move).toEqual({ type: "result", picks: [] });
    expect(view(send(s, A, move)).results[A]).toEqual({ rounds: 0, hits: 0 });
  });

  test("pomyłka w pierwszej rundzie z trafionym celem jest wyżej niż limit czasu", () => {
    let s = fresh();
    s = send(s, A, game.timeoutMove!(s, A, createRng(1)));
    s = send(s, B, play(0, MISS[1]));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A] });
  });
});

describe("stan", () => {
  test("oddanie wyniku nie zmienia poprzedniego stanu, a stan przeżywa JSON", () => {
    const s = fresh();
    const before = JSON.stringify(s);
    const next = send(s, A, play(2, MISS[1]));
    expect(JSON.stringify(s)).toBe(before);
    const copy = JSON.parse(JSON.stringify(next)) as State;
    expect(copy).toEqual(next);
    expect(game.isOver(send(copy, B, play(3)))).toEqual({ winner: B, ranking: [B, A] });
  });
});
