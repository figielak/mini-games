import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { build, left, LEVELS, MAX_STOP_MS, MIN_WIDTH, type Move, SNAP, START_WIDTH, type State, type View, wieza as game } from "./wieza.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy grają naraz u siebie tę samą wieżę: najwyżej 30 pięter, serwer losuje stronę startu każdego klocka,
// - klocek ma szerokość poprzedniego i jeździ od krawędzi do krawędzi; pozycja to wzór od czasu (left), tempo rośnie z każdym piętrem,
// - odchyłka do 0,02 wyrównuje klocek bez ucinania, większa zostawia część wspólną, część wspólna poniżej 0,02 to pudło i koniec,
// - klient oddaje jeden wynik: czasy zatrzymania kolejnych klocków (int 0-5000 ms), wieżę liczy serwer (build),
// - ruch progress zgłasza wysokość wieży (1-29) do podglądu u rywali i nie odnawia limitu,
// - ranking: wyższa wieża wyżej, przy równych szerszy ostatni klocek; zwycięzca tylko przy 2+ graczach i bez remisu.

const A = "ania";
const B = "bartek";
const C = "celina";

const BASE = { left: (1 - START_WIDTH) / 2, width: START_WIDTH };

const view = (s: State, player = A) => game.playerView(s, player) as View;
const fresh = (players = [A, B], seed = 1) => game.setup(players, createRng(seed));

/** Klocek, na który spada następny. */
const top = (sides: boolean[], stops: number[]) => build(sides, stops).blocks.at(-1) ?? BASE;

/** Odchyłka następnego klocka od poprzedniego, gdyby zatrzymać go w chwili `t`. */
const offsetAt = (sides: boolean[], stops: number[], t: number) => {
  const prev = top(sides, stops);
  return left(sides[stops.length], stops.length, prev.width, t) - prev.left;
};

/** Czas zatrzymania następnego klocka, przy którym odchyłka jest najbliżej `offset` (0 = idealnie). */
function stopAt(sides: boolean[], stops: number[], offset = 0) {
  let best = 0;
  for (let t = 0; t <= MAX_STOP_MS; t++) {
    if (Math.abs(offsetAt(sides, stops, t) - offset) < Math.abs(offsetAt(sides, stops, best) - offset)) best = t;
  }
  return best;
}

/** Czasy gracza, który położył `perfect` klocków idealnie, a kolejne z odchyłkami `offsets`. */
function stops(s: State, perfect: number, ...offsets: number[]) {
  const { sides } = view(s);
  const out: number[] = [];
  for (let i = 0; i < perfect; i++) out.push(stopAt(sides, out));
  for (const offset of offsets) out.push(stopAt(sides, out, offset));
  return out;
}

const play = (s: State, perfect: number, ...offsets: number[]): Move => ({ type: "result", stops: stops(s, perfect, ...offsets) });

/** Tak ruch widzi platforma: najpierw kształt, potem reguły. */
const accepts = (s: State, player: string, move: unknown) => {
  const parsed = game.moveSchema.safeParse(move);
  return parsed.success && game.validateMove(s, player, parsed.data);
};

function send(s: State, player: string, move: Move): State {
  expect(accepts(s, player, move), `${player} oddaje wynik`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

/** Prędkość klocka na piętrze (pole na sekundę): najdłuższy krok 10 ms, bo krok z odbiciem od krawędzi wychodzi krótszy. */
function speed(level: number) {
  const steps = [0, 300, 700].map((t) => Math.abs(left(true, level, START_WIDTH, t + 10) - left(true, level, START_WIDTH, t)));
  return Math.max(...steps) * 100;
}

describe("definicja", () => {
  test("1-6 graczy, limit 180 s, świeża gra trwa", () => {
    expect([game.id, game.minPlayers, game.maxPlayers, game.turnSeconds]).toEqual(["wieza", 1, 6, 180]);
    expect(game.isOver(fresh())).toBeNull();
  });

  test("najwyżej 30 pięter, podstawa 0,4, tolerancja i najwęższy klocek 0,02, klocek spada sam po 5 s", () => {
    expect([LEVELS, START_WIDTH, SNAP, MIN_WIDTH, MAX_STOP_MS]).toEqual([30, 0.4, 0.02, 0.02, 5000]);
  });
});

describe("setup", () => {
  test("wszyscy grają naraz i dostają te same strony startu", () => {
    const s = fresh();
    expect(game.waitingFor(s)).toEqual([A, B]);
    expect(view(s, A).sides).toEqual(view(s, B).sides);
    expect(view(s, "").sides).toEqual(view(s, A).sides);
  });

  test("strona startu dla każdego z 30 pięter", () => {
    const { sides } = view(fresh());
    expect(sides).toHaveLength(LEVELS);
    for (const side of sides) expect(typeof side).toBe("boolean");
  });

  test("ten sam seed to te same strony, rewanż daje inne", () => {
    expect(view(fresh([A], 1)).sides).toEqual(view(fresh([A], 1)).sides);
    expect(view(fresh([A], 1)).sides).not.toEqual(view(fresh([A], 2)).sides);
  });
});

describe("ruch klocka", () => {
  const WIDTHS = [START_WIDTH, 0.2, MIN_WIDTH];

  test("klocek startuje przy swojej krawędzi pola", () => {
    for (const width of WIDTHS) {
      expect(left(true, 3, width, 0)).toBeCloseTo(0, 9);
      expect(left(false, 3, width, 0)).toBeCloseTo(1 - width, 9);
    }
  });

  test("klocek nigdy nie wychodzi poza pole (zawraca przy krawędzi)", () => {
    for (const width of WIDTHS) {
      for (const fromLeft of [true, false]) {
        for (let level = 0; level < LEVELS; level++) {
          for (let t = 0; t <= MAX_STOP_MS; t += 50) {
            const x = left(fromLeft, level, width, t);
            expect(x).toBeGreaterThanOrEqual(-1e-9);
            expect(x).toBeLessThanOrEqual(1 - width + 1e-9);
          }
        }
      }
    }
  });

  test("klocki z obu stron jadą lustrzanie", () => {
    for (const t of [0, 400, 1700, MAX_STOP_MS]) {
      expect(left(true, 5, 0.3, t) + left(false, 5, 0.3, t)).toBeCloseTo(0.7, 9);
    }
  });

  test("z każdym piętrem klocek jedzie szybciej", () => {
    for (let level = 1; level < LEVELS; level++) expect(speed(level)).toBeGreaterThan(speed(level - 1));
  });

  test("pierwsze piętro 0,5 pola na sekundę, każde następne o 0,03 więcej", () => {
    expect(speed(0)).toBeCloseTo(0.5, 5);
    expect(speed(1)).toBeCloseTo(0.53, 5);
    expect(speed(LEVELS - 1)).toBeCloseTo(0.5 + 0.03 * (LEVELS - 1), 5);
  });

  test("po 5 s klocek stoi", () => {
    expect(left(true, 0, START_WIDTH, MAX_STOP_MS + 1000)).toBe(left(true, 0, START_WIDTH, MAX_STOP_MS));
  });
});

describe("wieża", () => {
  const s = fresh();
  const { sides } = view(s);
  const tower = (perfect: number, ...offsets: number[]) => build(sides, stops(s, perfect, ...offsets));

  test("bez klocków: wysokość 0 i szerokość podstawy", () => {
    expect(build(sides, [])).toEqual({ blocks: [], height: 0, width: START_WIDTH });
  });

  test("trafienie idealne wyrównuje klocek i zachowuje szerokość", () => {
    const { blocks, height, width } = tower(3);
    expect(height).toBe(3);
    expect(width).toBe(START_WIDTH);
    for (const block of blocks) expect(block).toEqual(BASE);
  });

  test.each([-0.015, 0.015])("odchyłka w tolerancji (%f) też wyrównuje", (offset) => {
    const mine = stops(s, 1, offset);
    expect(Math.abs(offsetAt(sides, mine.slice(0, 1), mine[1]))).toBeGreaterThan(0.01);
    expect(build(sides, mine).blocks[1]).toEqual(BASE);
  });

  test("odchyłka w prawo ucina prawą stronę klocka", () => {
    const mine = stops(s, 1, 0.1);
    const d = offsetAt(sides, mine.slice(0, 1), mine[1]);
    const block = build(sides, mine).blocks[1];
    expect(block.left).toBeCloseTo(BASE.left + d, 9);
    expect(block.width).toBeCloseTo(START_WIDTH - d, 9);
    expect(block.width).toBeCloseTo(0.3, 2);
  });

  test("odchyłka w lewo ucina lewą stronę klocka", () => {
    const mine = stops(s, 1, -0.1);
    const d = offsetAt(sides, mine.slice(0, 1), mine[1]);
    const block = build(sides, mine).blocks[1];
    expect(block.left).toBeCloseTo(BASE.left, 9);
    expect(block.width).toBeCloseTo(START_WIDTH + d, 9);
    expect(block.width).toBeCloseTo(0.3, 2);
  });

  test("tuż ponad tolerancją klocek jest już ucinany", () => {
    expect(tower(0, 0.03).width).toBeLessThan(START_WIDTH - SNAP);
  });

  test("następny klocek ma szerokość poprzedniego i wieża już się nie poszerza", () => {
    const { blocks } = tower(0, 0.1, 0, -0.05, 0);
    expect(blocks).toHaveLength(4);
    expect(blocks[1]).toEqual(blocks[0]);
    expect(blocks[2].width).toBeLessThan(blocks[1].width);
    expect(blocks[3]).toEqual(blocks[2]);
  });

  test("pierwszy klocek zawsze trafia", () => {
    for (let t = 0; t <= MAX_STOP_MS; t += 10) expect(build(sides, [t]).height).toBe(1);
  });

  test("część wspólna węższa niż 0,02 to pudło: wieża zostaje, jaka była", () => {
    const before = tower(0, 0.2);
    const after = tower(0, 0.2, -0.3);
    expect(before.width).toBeCloseTo(0.2, 2);
    expect(after).toEqual(before);
  });

  test("klocek obok poprzedniego to też pudło", () => {
    expect(tower(0, 0.2, 0.19).height).toBe(1);
    expect(tower(0, 0.2, 0.17).height).toBe(2);
  });

  test("czasy po pudle są ignorowane", () => {
    const missed = stops(s, 0, 0.2, -0.3);
    expect(build(sides, [...missed, 600, 600, 600])).toEqual(build(sides, missed));
  });

  test("wszystkie 30 pięter idealnie", () => {
    expect(tower(LEVELS)).toMatchObject({ height: LEVELS, width: START_WIDTH });
  });
});

describe("walidacja", () => {
  const s = fresh();
  const one = (t: unknown) => ({ type: "result", stops: [t] });

  test("obcy gracz", () => expect(accepts(s, C, play(s, 3))).toBe(false));
  test("drugi wynik tego samego gracza", () => expect(accepts(send(s, A, play(s, 3)), A, play(s, 4))).toBe(false));
  test("wynik po końcu gry", () => {
    const over = send(send(s, A, play(s, 3)), B, play(s, 4));
    expect(accepts(over, A, play(s, 5))).toBe(false);
  });

  test("czas zatrzymania od 0 do 5000 ms", () => {
    expect(accepts(s, A, one(-1))).toBe(false);
    expect(accepts(s, A, one(0))).toBe(true);
    expect(accepts(s, A, one(MAX_STOP_MS))).toBe(true);
    expect(accepts(s, A, one(MAX_STOP_MS + 1))).toBe(false);
  });

  test("najwyżej tyle czasów, ile jest pięter", () => {
    expect(accepts(s, A, { type: "result", stops: Array(LEVELS).fill(600) })).toBe(true);
    expect(accepts(s, A, { type: "result", stops: Array(LEVELS + 1).fill(600) })).toBe(false);
  });

  test.each([
    ["czas niecałkowity", { type: "result", stops: [600.5] }],
    ["czas tekstem", { type: "result", stops: ["600"] }],
    ["czas pusty", { type: "result", stops: [null] }],
    ["brak listy", { type: "result" }],
    ["lista nie jest listą", { type: "result", stops: 600 }],
    ["zły typ ruchu", { type: "progress", stops: [] }],
  ])("schemat odrzuca: %s", (_, move) => {
    expect(game.moveSchema.safeParse(move).success).toBe(false);
  });
});

describe("postęp", () => {
  const s = fresh();
  const progress = (height: unknown) => ({ type: "progress", height }) as Move;

  test("wysokość wieży widzą rywale i obserwator, wynik się nie zmienia", () => {
    expect(view(s, B).progress).toEqual({});
    const after = send(s, A, progress(3));
    expect(view(after, B).progress).toEqual({ [A]: 3 });
    expect(view(after, "").progress).toEqual({ [A]: 3 });
    expect(after.results).toEqual({});
    expect(game.waitingFor(after)).toEqual([A, B]);
    expect(s.progress).toEqual({});
  });

  test("po postępie gracz nadal może oddać wynik", () => {
    expect(view(send(send(s, A, progress(3)), A, play(s, 3))).results[A].height).toBe(3);
  });

  test("wysokość od 1 do 29 (trzydzieste piętro to już wynik)", () => {
    expect(accepts(s, A, progress(0))).toBe(false);
    expect(accepts(s, A, progress(1))).toBe(true);
    expect(accepts(s, A, progress(LEVELS - 1))).toBe(true);
    expect(accepts(s, A, progress(LEVELS))).toBe(false);
  });

  test("obcy gracz", () => expect(accepts(s, C, progress(3))).toBe(false));
  test("po oddaniu wyniku", () => expect(accepts(send(s, A, play(s, 3)), A, progress(4))).toBe(false));

  test("postęp nie odnawia limitu", () => {
    expect(game.turn!(send(s, A, progress(5)))).toEqual(game.turn!(s));
    expect(game.turn!(s).seconds).toBe(180);
  });

  test.each([
    ["ułamek", progress(1.5)],
    ["tekst", progress("3")],
    ["brak wysokości", { type: "progress" }],
  ])("schemat odrzuca: %s", (_, move) => {
    expect(game.moveSchema.safeParse(move).success).toBe(false);
  });
});

describe("koniec", () => {
  test("gra trwa, dopóki ktoś nie oddał wyniku", () => {
    const s = send(fresh(), A, play(fresh(), 3));
    expect(game.waitingFor(s)).toEqual([B]);
    expect(game.isOver(s)).toBeNull();
    expect(view(s, B).results[A]).toEqual({ height: 3, width: START_WIDTH });
  });

  test("wyższa wieża wygrywa, przy równych szerszy ostatni klocek", () => {
    let s = fresh([A, B, C]);
    s = send(s, A, play(s, 3, 0.1));
    s = send(s, B, play(s, 6, 0.2));
    s = send(s, C, play(s, 4));
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test.each([A, B, C])("wygrać może każdy: %s", (best) => {
    let s = fresh([A, B, C]);
    for (const p of [A, B, C]) s = send(s, p, play(s, p === best ? 9 : 4));
    expect(game.isOver(s)?.winner).toBe(best);
  });

  test("ta sama wysokość i szerokość: remis bez zwycięzcy", () => {
    let s = fresh();
    s = send(s, A, play(s, 5, 0.1));
    s = send(s, B, play(s, 5, 0.1));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("obaj doszli idealnie do końca: remis bez zwycięzcy", () => {
    let s = fresh();
    s = send(s, A, play(s, LEVELS));
    s = send(s, B, play(s, LEVELS));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("solo: bez zwycięzcy", () => {
    const s = fresh([A]);
    expect(game.isOver(send(s, A, play(s, 8)))).toEqual({ ranking: [A] });
  });

  test("po limicie czasu pusty wynik, czyli zero pięter", () => {
    const s = fresh();
    const move = game.timeoutMove!(s, A, createRng(1));
    expect(move).toEqual({ type: "result", stops: [] });
    expect(view(send(s, A, move)).results[A]).toEqual({ height: 0, width: START_WIDTH });
  });

  test("jeden wąski klocek jest wyżej niż limit czasu", () => {
    let s = fresh();
    s = send(s, A, game.timeoutMove!(s, A, createRng(1)));
    s = send(s, B, { type: "result", stops: [0] });
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A] });
  });
});

describe("stan", () => {
  test("oddanie wyniku nie zmienia poprzedniego stanu, a stan przeżywa JSON", () => {
    const s = fresh();
    const before = JSON.stringify(s);
    const next = send(s, A, play(s, 2, 0.1));
    expect(JSON.stringify(s)).toBe(before);
    const copy = JSON.parse(JSON.stringify(next)) as State;
    expect(copy).toEqual(next);
    expect(game.isOver(send(copy, B, play(s, 3)))).toEqual({ winner: B, ranking: [B, A] });
  });
});
