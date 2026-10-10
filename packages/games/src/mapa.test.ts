import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { ASPECT, BOUNDS, type City, distance, locate, mapa as game, MAX_ERROR, type Move, place, type Point, ROUNDS, type State } from "./mapa.ts";
import { CITIES, OUTLINE } from "./mapa-dane.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 1-6 graczy naraz, każdy dostaje te same 10 różnych miast z puli (wszystkie leżą w konturze Polski),
// - pole gry to prostokąt geograficzny BOUNDS, x = długość, y = szerokość (północ u góry); place i locate są odwrotne,
// - odpowiedź to 10 punktów w ułamkach pola; błąd rundy to odległość po ortodromie do miasta, zaokrąglona do km,
// - punkt poza konturem jest ważny, punkt poza polem odrzuca cały ruch,
// - wynik = suma km (int), mniejsza wyżej; pusta odpowiedź (limit czasu) to 10 × MAX_ERROR, czyli więcej niż najgorsza uczciwa partia.

const A = "ania";
const B = "bartek";
const C = "celina";

const KM_PER_DEG = (6371 * Math.PI) / 180;
const WARSZAWA = { lat: 52.23, lon: 21.01 };
const KRAKOW = { lat: 50.06, lon: 19.94 };
const GDANSK = { lat: 54.35, lon: 18.65 };
const RZESZOW = { lat: 50.04, lon: 22.0 };

const result = (taps: Point[]): Move => ({ type: "result", taps });
/** Punkt dokładnie w mieście. */
const exact = (s: State): Point[] => s.cities.map(place);
/** Każdy punkt przesunięty o `km` na południe od miasta (wzdłuż południka, więc odległość jest dokładna). */
const south = (s: State, km: number): Point[] => s.cities.map((c: City) => place({ lat: c.lat - km / KM_PER_DEG, lon: c.lon }));
/** Czy punkt leży w konturze (promień w prawo, liczba przecięć). */
const inside = (lon: number, lat: number) =>
  OUTLINE.reduce((hit, [x1, y1], i) => {
    const [x2, y2] = OUTLINE[(i + 1) % OUTLINE.length];
    return y1 > lat !== y2 > lat && lon < x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1) ? !hit : hit;
  }, false);

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player} oddaje odpowiedzi`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

test("definicja: 1-6 graczy, limit 180 s, świeża gra trwa", () => {
  expect(game.minPlayers).toBe(1);
  expect(game.maxPlayers).toBe(6);
  expect(game.turnSeconds).toBe(180);
  expect(game.isOver(game.setup([A], createRng(1)))).toBeNull();
});

test("10 różnych miast z puli, te same dla wszystkich, rewanż ma inne wyzwanie", () => {
  expect(ROUNDS).toBe(10);
  const names = new Set(CITIES.map(([name]) => name));
  for (let seed = 1; seed <= 20; seed++) {
    const { cities } = game.setup([A, B], createRng(seed));
    expect(cities).toHaveLength(ROUNDS);
    expect(new Set(cities.map((c) => c.name)).size).toBe(ROUNDS);
    for (const c of cities) {
      expect(names.has(c.name)).toBe(true);
      expect(CITIES).toContainEqual([c.name, c.lat, c.lon]);
    }
  }
  const s = game.setup([A, B], createRng(1));
  expect(game.waitingFor(s)).toEqual([A, B]);
  expect(game.setup([A, B], createRng(1))).toEqual(s);
  expect(game.setup([A, B], createRng(2)).cities).not.toEqual(s.cities);
});

describe("dane", () => {
  test("pula ma co najmniej 50 miast, nazwy się nie powtarzają", () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(CITIES.map(([name]) => name)).size).toBe(CITIES.length);
  });
  test.each(CITIES.map(([name, lat, lon]) => ({ name, lat, lon })))("$name leży w polu i w konturze Polski", ({ lat, lon }) => {
    expect(lon).toBeGreaterThan(BOUNDS.west);
    expect(lon).toBeLessThan(BOUNDS.east);
    expect(lat).toBeGreaterThan(BOUNDS.south);
    expect(lat).toBeLessThan(BOUNDS.north);
    expect(inside(lon, lat)).toBe(true);
  });
  test("kontur mieści się w polu, a środek Polski jest w konturze", () => {
    expect(OUTLINE.length).toBeGreaterThan(50);
    for (const [lon, lat] of OUTLINE) {
      const p = place({ lat, lon });
      for (const v of [p.x, p.y]) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThan(1);
      }
    }
    expect(inside(19.4, 52.1)).toBe(true);
    // Berlin i Lwów leżą w polu, ale poza konturem.
    expect(inside(13.95, 52.5)).toBe(false);
    expect(inside(24.03, 49.84)).toBe(false);
  });
});

describe("odwzorowanie", () => {
  test("x to długość, y to szerokość, północ u góry", () => {
    expect(place({ lat: BOUNDS.north, lon: BOUNDS.west })).toEqual({ x: 0, y: 0 });
    expect(place({ lat: BOUNDS.south, lon: BOUNDS.east })).toEqual({ x: 1, y: 1 });
    expect(place(GDANSK).y).toBeLessThan(place(KRAKOW).y);
    expect(place(RZESZOW).x).toBeGreaterThan(place(KRAKOW).x);
  });
  test("place i locate są odwrotne", () => {
    const back = locate(place(WARSZAWA));
    expect(back.lat).toBeCloseTo(WARSZAWA.lat);
    expect(back.lon).toBeCloseTo(WARSZAWA.lon);
    const p = place(locate({ x: 0.3, y: 0.8 }));
    expect(p.x).toBeCloseTo(0.3);
    expect(p.y).toBeCloseTo(0.8);
  });
  test("proporcje pola: szerokość ściśnięta cos 52°", () => {
    const width = (BOUNDS.east - BOUNDS.west) * Math.cos((52 * Math.PI) / 180);
    expect(ASPECT).toBeCloseTo(width / (BOUNDS.north - BOUNDS.south));
    // Na telefonie w pionie pole nie może być wyższe niż szersze.
    expect(ASPECT).toBeGreaterThanOrEqual(1);
  });
});

describe("odległość", () => {
  test("znane odległości w linii prostej", () => {
    expect(Math.abs(distance(WARSZAWA, KRAKOW) - 252)).toBeLessThan(5);
    expect(Math.abs(distance(GDANSK, RZESZOW) - 530)).toBeLessThan(5);
  });
  test("ten sam punkt = 0, w obie strony tak samo", () => {
    expect(distance(WARSZAWA, WARSZAWA)).toBe(0);
    expect(distance(WARSZAWA, GDANSK)).toBeCloseTo(distance(GDANSK, WARSZAWA));
  });
  test("stopień szerokości to ok. 111 km", () => expect(distance({ lat: 51, lon: 19 }, { lat: 52, lon: 19 })).toBeCloseTo(KM_PER_DEG));
  test("najgorsza uczciwa runda kosztuje mniej niż runda po limicie czasu", () => {
    expect(MAX_ERROR).toBe(1000);
    const corner = (x: number, y: number) => locate({ x, y });
    expect(distance(corner(0, 0), corner(1, 1))).toBeLessThan(MAX_ERROR);
    expect(distance(corner(1, 0), corner(0, 1))).toBeLessThan(MAX_ERROR);
  });
});

describe("walidacja", () => {
  const s = game.setup([A, B], createRng(1));
  const ok = exact(s);
  const last = (p: unknown) => [...ok.slice(0, 9), p as Point];
  test.each([
    ["za mało", ok.slice(0, 9)],
    ["za dużo", [...ok, ok[0]]],
    ["tuż za lewą krawędzią", last({ x: -0.01, y: 0.5 })],
    ["tuż za prawą krawędzią", last({ x: 1.01, y: 0.5 })],
    ["tuż nad polem", last({ x: 0.5, y: -0.01 })],
    ["tuż pod polem", last({ x: 0.5, y: 1.01 })],
    ["NaN", last({ x: Number.NaN, y: 0.5 })],
    ["nieskończoność", last({ x: 0.5, y: Number.POSITIVE_INFINITY })],
  ])("odrzucone: %s", (_, taps) => expect(game.validateMove(s, A, result(taps))).toBe(false));
  test("rogi pola przechodzą", () => {
    expect(game.validateMove(s, A, result(last({ x: 0, y: 0 })))).toBe(true);
    expect(game.validateMove(s, A, result(last({ x: 1, y: 1 })))).toBe(true);
  });
  test("punkt poza konturem Polski jest ważną odpowiedzią", () => {
    const berlin = place({ lat: 52.5, lon: 13.95 });
    const next = send(s, A, result(last(berlin)));
    expect(next.results[A]).toBe(Math.round(distance(s.cities[9], { lat: 52.5, lon: 13.95 })));
  });
  test("obcy gracz", () => expect(game.validateMove(s, C, result(ok))).toBe(false));
  test("drugi wynik", () => expect(game.validateMove(send(s, A, result(ok)), A, result(ok))).toBe(false));
  test("ruch po końcu gry", () => expect(game.validateMove(send(send(s, A, result(ok)), B, result(ok)), A, result(ok))).toBe(false));
  test("pusta odpowiedź", () => expect(game.validateMove(s, A, result([]))).toBe(true));

  test("schemat odrzuca śmieci z sieci", () => {
    const parses = (m: unknown) => game.moveSchema.safeParse(m).success;
    expect(parses(result(ok))).toBe(true);
    expect(parses(result([]))).toBe(true);
    expect(parses({ type: "result" })).toBe(false);
    expect(parses({ type: "result", taps: [{ x: "0.5", y: 0.5 }] })).toBe(false);
    expect(parses({ type: "result", taps: [{ x: 0.5 }] })).toBe(false);
    expect(parses({ type: "result", taps: Array(ROUNDS + 1).fill({ x: 0.5, y: 0.5 }) })).toBe(false);
    expect(parses({ type: "skok" })).toBe(false);
  });
});

describe("koniec", () => {
  test("dokładnie w mieście = 0 km, pusta = 10 × MAX_ERROR, punkty zostają w stanie", () => {
    let s = game.setup([A, B], createRng(1));
    const before = JSON.stringify(s);
    const next = send(s, A, result(exact(s)));
    expect(JSON.stringify(s), "applyMove nie zmienia poprzedniego stanu").toBe(before);
    s = send(next, B, result([]));
    expect(s.results).toEqual({ [A]: 0, [B]: ROUNDS * MAX_ERROR });
    expect(s.taps[A]).toEqual(exact(s));
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
    expect(game.waitingFor(s)).toEqual([]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  test("odległości sumują się w pełnych km, mniejsza suma wygrywa (także gdy to nie pierwszy gracz)", () => {
    let s = game.setup([A, B, C], createRng(1));
    expect(game.isOver(s)).toBeNull();
    s = send(s, A, result(south(s, 30)));
    expect(game.waitingFor(s)).toEqual([B, C]);
    s = send(s, B, result(south(s, 10)));
    s = send(s, C, result(south(s, 20)));
    expect(s.results).toEqual({ [A]: 300, [B]: 100, [C]: 200 });
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("każda runda jest zaokrąglana osobno", () => {
    const s = game.setup([A], createRng(1));
    // 10 × 0,4 km to 0, nie 4.
    expect(send(s, A, result(south(s, 0.4))).results[A]).toBe(0);
    expect(send(s, A, result(south(s, 0.6))).results[A]).toBe(ROUNDS);
  });

  test("wygrywa też ostatni gracz", () => {
    let s = game.setup([A, B, C], createRng(3));
    s = send(s, A, result(south(s, 20)));
    s = send(s, B, result(south(s, 30)));
    s = send(s, C, result(south(s, 5)));
    expect(game.isOver(s)).toEqual({ winner: C, ranking: [C, A, B] });
  });

  test("remis: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(1));
    s = send(s, A, result(south(s, 20)));
    s = send(s, B, result(south(s, 20)));
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });

  test("gra solo kończy się rankingiem bez zwycięzcy", () => {
    const s = game.setup([A], createRng(1));
    expect(game.isOver(send(s, A, result(exact(s))))).toEqual({ ranking: [A] });
  });

  test("po limicie czasu pusta odpowiedź, czyli najgorszy możliwy wynik", () => {
    const s = game.setup([A, B], createRng(1));
    const move = game.timeoutMove!(s, A, createRng(1));
    expect(move).toEqual(result([]));
    // Rywal wskazuje w każdej rundzie róg pola najdalszy od miasta.
    const corners = [0, 1].flatMap((x) => [0, 1].map((y) => ({ x, y })));
    const far = send(s, B, result(s.cities.map((c) => corners.reduce((a, b) => (distance(c, locate(a)) > distance(c, locate(b)) ? a : b)))));
    expect(send(far, A, move).results[A]).toBe(ROUNDS * MAX_ERROR);
    expect(far.results[B]).toBeLessThan(ROUNDS * MAX_ERROR);
  });
});
