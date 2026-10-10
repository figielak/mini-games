import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { MAX_CELLS, MIN_CELLS, type Move, obrot as game, score, type State, type View } from "./obrot.ts";
import { DURATION_MS } from "./quiz.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - wszyscy dostają te same pary figur z klocków: `a`, `b` i `mirror` (czy `b` to lustrzane odbicie `a`),
// - figura to spójne poliomino dosunięte do rogu (0, 0), klocków przybywa co 3 pary od 4 do 7,
// - `b` to `a` (albo jej odbicie) obrócona o 90, 180 albo 270°; figura jest chiralna, więc odpowiedź jest jedna,
// - klient oddaje czasy trafień (150-5000 ms, razem max 30 s) i liczbę pomyłek,
// - wynik = trafienia − pomyłki, nie mniej niż 0; ranking: więcej punktów wyżej, remis rozstrzyga niższa średnia.

const A = "ania";
const B = "bartek";
const C = "celina";

type Cells = [number, number][];

const result = (times: number[], errors = 0): Move => ({ type: "result", times, errors });

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

const trialsOf = (seed: number) => (game.playerView(game.setup([A, B], createRng(seed)), A) as View).trials;
const ALL = [1, 2, 3, 4, 5].flatMap(trialsOf);

/** Figura niezależnie od kolejności pól i położenia: dosunięta do rogu i posortowana. */
function key(cells: Cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => `${x - minX},${y - minY}`)
    .sort()
    .join(" ");
}
const turn = (cells: Cells): Cells => cells.map(([x, y]) => [-y, x]);
const flip = (cells: Cells): Cells => cells.map(([x, y]) => [-x, y]);
/** Cztery obroty figury, zaczynając od 0°. */
const turns = (cells: Cells) => [cells, turn(cells), turn(turn(cells)), turn(turn(turn(cells)))].map(key);

test("definicja: 1-6 graczy, limit 90 s, świeża gra trwa", () => {
  expect([game.id, game.minPlayers, game.maxPlayers, game.turnSeconds]).toEqual(["obrot", 1, 6, 90]);
  const s = game.setup([A, B], createRng(1));
  expect(game.isOver(s)).toBeNull();
  expect(game.waitingFor(s)).toEqual([A, B]);
});

describe("pary figur", () => {
  test("wystarczy ich na 30 s", () => expect(trialsOf(1).length * 150).toBeGreaterThanOrEqual(DURATION_MS));

  test("ten sam seed daje te same pary, inny seed (rewanż) inne", () => {
    expect(trialsOf(1)).toEqual(trialsOf(1));
    expect(trialsOf(1)).not.toEqual(trialsOf(2));
  });

  test("klocków przybywa co 3 pary, od 4 do 7", () => {
    const sizes = trialsOf(1).map((t) => t.a.length);
    expect(sizes.slice(0, 12)).toEqual([4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7]);
    expect(sizes.slice(9).every((n) => n === MAX_CELLS)).toBe(true);
    expect([MIN_CELLS, MAX_CELLS]).toEqual([4, 7]);
    for (const t of ALL) expect(t.b).toHaveLength(t.a.length);
  });

  test("figura to pola całkowite bez powtórek, dosunięte do rogu (0, 0)", () => {
    for (const t of ALL)
      for (const cells of [t.a, t.b]) {
        expect(cells.flat().every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
        expect(new Set(cells.map(String)).size).toBe(cells.length);
        expect(Math.min(...cells.map(([x]) => x))).toBe(0);
        expect(Math.min(...cells.map(([, y]) => y))).toBe(0);
      }
  });

  test("figura jest spójna: do każdego klocka da się dojść bokami", () => {
    for (const t of ALL)
      for (const cells of [t.a, t.b]) {
        const left = new Set(cells.map(String));
        const queue = [cells[0]];
        left.delete(String(cells[0]));
        for (const [x, y] of queue)
          for (const next of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as Cells) if (left.delete(String(next))) queue.push(next);
        expect(left.size).toBe(0);
      }
  });

  test("bez lustra druga figura to obrót pierwszej, z lustrem obrót jej odbicia, nigdy jedno i drugie", () => {
    for (const t of ALL) {
      expect(turns(t.a).includes(key(t.b)), "obrót").toBe(!t.mirror);
      expect(turns(flip(t.a)).includes(key(t.b)), "obrót odbicia").toBe(t.mirror);
    }
  });

  test("druga figura jest zawsze obrócona: obrotu o 0° nie ma", () => {
    for (const t of ALL) expect(key(t.b)).not.toBe(key(t.mirror ? flip(t.a) : t.a));
    // Wszystkie trzy kąty występują.
    const angles = new Set(ALL.map((t) => turns(t.mirror ? flip(t.a) : t.a).indexOf(key(t.b))));
    expect([...angles].sort()).toEqual([1, 2, 3]);
  });

  test("obie odpowiedzi padają mniej więcej po równo", () => {
    const mirrors = ALL.filter((t) => t.mirror).length;
    expect(mirrors).toBeGreaterThan(ALL.length * 0.4);
    expect(mirrors).toBeLessThan(ALL.length * 0.6);
  });

  test("figury się nie powtarzają w kółko", () => {
    expect(new Set(trialsOf(1).slice(9).map((t) => turns(t.a).sort()[0])).size).toBeGreaterThan(30);
  });
});

describe("punktacja", () => {
  test("wynik to trafienia minus pomyłki, nie mniej niż 0", () => {
    expect(score({ times: [500, 500, 500], errors: 1 })).toBe(2);
    expect(score({ times: [500], errors: 4 })).toBe(0);
    expect(score({ times: [], errors: 0 })).toBe(0);
  });

  test("mniej trafień bez pomyłek wygrywa z większą liczbą trafień i wieloma pomyłkami", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(Array(8).fill(400), 6));
    s = send(s, B, result(Array(3).fill(900)));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A] });
  });

  test("przy równych punktach wygrywa niższa średnia czasu", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result([600, 600]));
    s = send(s, B, result([500, 500, 500], 1));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A] });
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
  ])("więcej punktów wygrywa (%s), remis rozstrzyga średnia", (winner, ranking) => {
    let s = game.setup([A, B, C], createRng(1));
    for (const p of [A, B, C]) {
      expect(game.isOver(s)).toBeNull();
      // Zwycięzca ma 3 punkty (5 trafień − 2), pozostali po 2; z nich wyżej ten z niższą średnią.
      s = send(s, p, p === winner ? result(Array(5).fill(700), 2) : result(p === ranking[1] ? [500, 500] : [600, 600]));
    }
    expect(game.isOver(s)).toEqual({ winner, ranking });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test("remis na górze i dwa wyniki bez trafień: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result([600, 400]));
    expect(game.waitingFor(s)).toEqual([B]);
    s = send(s, B, result([500, 500, 500], 1));
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
