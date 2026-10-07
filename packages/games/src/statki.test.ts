import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { isValidFleet, type Move, randomFleet, type Ship, statki as game, type State, type View } from "./statki.ts";

// Testy napisane przed implementacją (etap 3). Ustalają zasady:
// - plansza 10×10, flota 1×4, 2×3, 3×2, 4×1, statki nie stykają się (także rogami),
// - na start flota losowa; w fazie rozstawiania można ją wymienić ruchem `place`, potem `ready`,
// - bitwa startuje, gdy obaj gotowi; strzela players[0]; trafienie = kolejny strzał, pudło oddaje turę,
// - zatopienie odsłania statek i oznacza pola wokół jako "around",
// - widok: boards[id].ships to wszystkie statki właściciela, a dla innych tylko zatopione.

const A = "ania";
const B = "bartek";
const rng = createRng(1);
const SIZE = 10;

// Poprawna flota: rzędy 0, 2 i 4, przerwy między statkami.
const FLEET: Ship[] = [
  { x: 0, y: 0, length: 4, vertical: false },
  { x: 5, y: 0, length: 3, vertical: false },
  { x: 0, y: 2, length: 3, vertical: false },
  { x: 4, y: 2, length: 2, vertical: false },
  { x: 7, y: 2, length: 2, vertical: false },
  { x: 0, y: 4, length: 2, vertical: false },
  { x: 3, y: 4, length: 1, vertical: false },
  { x: 5, y: 4, length: 1, vertical: false },
  { x: 7, y: 4, length: 1, vertical: false },
  { x: 9, y: 4, length: 1, vertical: false },
];

/** Ta sama flota przesunięta na dół planszy (dla B), żeby floty A i B się różniły. */
const FLEET_B: Ship[] = FLEET.map((s) => ({ ...s, y: s.y + 5 }));

const cells = (ship: Ship) =>
  Array.from({ length: ship.length }, (_, i) => ({
    x: ship.x + (ship.vertical ? 0 : i),
    y: ship.y + (ship.vertical ? i : 0),
  }));
const allCells = (fleet: Ship[]) => fleet.flatMap(cells);
const key = (c: { x: number; y: number }) => `${c.x},${c.y}`;

function apply(state: State, player: string, move: Move): State {
  expect(game.validateMove(state, player, move), `${player}: ${JSON.stringify(move)}`).toBe(true);
  return game.applyMove(state, player, move, rng);
}

/** Obaj ustawiają znane floty i są gotowi: zaczyna się bitwa. */
function battle(): State {
  let s = game.setup([A, B], rng);
  s = apply(s, A, { type: "place", ships: FLEET });
  s = apply(s, B, { type: "place", ships: FLEET_B });
  s = apply(s, A, { type: "ready" });
  return apply(s, B, { type: "ready" });
}

const view = (state: State, player: string) => game.playerView(state, player) as View;
const shoot = (state: State, player: string, x: number, y: number) => apply(state, player, { type: "shoot", x, y });

/** A strzela po kolei we wszystkie pola floty B (trafienia dają kolejne strzały). */
function sinkAll(state: State, upTo = Infinity): State {
  for (const c of allCells(FLEET_B).slice(0, upTo)) state = shoot(state, A, c.x, c.y);
  return state;
}

/** Wszystkie współrzędne {x, y} w obiekcie (statki rozwinięte na pola). */
function coordsIn(obj: unknown): string[] {
  if (Array.isArray(obj)) return obj.flatMap(coordsIn);
  if (obj && typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    if (typeof o.x === "number" && typeof o.y === "number") {
      return typeof o.length === "number" ? cells(o as unknown as Ship).map(key) : [key(o as { x: number; y: number })];
    }
    return Object.values(o).flatMap(coordsIn);
  }
  return [];
}

describe("flota", () => {
  test("wzorcowa flota jest poprawna", () => {
    expect(isValidFleet(FLEET)).toBe(true);
    expect(isValidFleet(FLEET_B)).toBe(true);
  });

  test("losowa flota jest zawsze poprawna", () => {
    for (let seed = 0; seed < 200; seed++) expect(isValidFleet(randomFleet(createRng(seed))), `seed ${seed}`).toBe(true);
  });

  test("losowe floty się różnią", () => {
    expect(randomFleet(createRng(1))).not.toEqual(randomFleet(createRng(2)));
  });

  const replace = (i: number, ship: Ship) => FLEET.map((s, j) => (j === i ? ship : s));

  test("statki stykające się bokiem są odrzucane", () => {
    // jedynka z (3,4) na (2,4): dotyka dwójki x0-1 w rzędzie 4
    expect(isValidFleet(replace(6, { x: 2, y: 4, length: 1, vertical: false }))).toBe(false);
  });

  test("statki stykające się rogiem są odrzucane", () => {
    // jedynka z (9,4) na (9,3): rogiem dotyka dwójki x7-8 w rzędzie 2
    expect(isValidFleet(replace(9, { x: 9, y: 3, length: 1, vertical: false }))).toBe(false);
  });

  test("nakładające się statki są odrzucane", () => {
    expect(isValidFleet(replace(9, { x: 0, y: 0, length: 1, vertical: false }))).toBe(false);
  });

  test("statek poza planszą jest odrzucany", () => {
    expect(isValidFleet(replace(9, { x: 9, y: 9, length: 1, vertical: false }))).toBe(true);
    expect(isValidFleet(replace(0, { x: 7, y: 9, length: 4, vertical: false }))).toBe(false);
    expect(isValidFleet(replace(0, { x: 9, y: 7, length: 4, vertical: true }))).toBe(false);
    expect(isValidFleet(replace(9, { x: -1, y: 9, length: 1, vertical: false }))).toBe(false);
  });

  test("zły skład floty jest odrzucany", () => {
    expect(isValidFleet(FLEET.slice(0, 9))).toBe(false);
    expect(isValidFleet(replace(9, { x: 9, y: 4, length: 2, vertical: true }))).toBe(false);
  });

  test("statki pionowe są dozwolone", () => {
    expect(isValidFleet(replace(0, { x: 9, y: 6, length: 4, vertical: true }))).toBe(true);
  });
});

describe("rozstawianie", () => {
  test("gra dla dokładnie 2 graczy", () => {
    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(2);
  });

  test("na start obaj mają poprawne, różne floty", () => {
    const s = game.setup([A, B], rng);
    const a = view(s, A).boards[A].ships;
    const b = view(s, B).boards[B].ships;
    expect(isValidFleet(a)).toBe(true);
    expect(isValidFleet(b)).toBe(true);
    expect(a).not.toEqual(b);
    expect(view(s, A).phase).toBe("placing");
  });

  test("poprawną flotę można przestawić, błędnej nie", () => {
    const s = game.setup([A, B], rng);
    expect(game.validateMove(s, A, { type: "place", ships: FLEET })).toBe(true);
    const bad = FLEET.map((sh, i) => (i === 9 ? { ...sh, x: 2 } : sh));
    expect(game.validateMove(s, A, { type: "place", ships: bad })).toBe(false);
    expect(view(apply(s, A, { type: "place", ships: FLEET }), A).boards[A].ships).toEqual(FLEET);
  });

  test("po gotowości nie można już przestawiać ani drugi raz zgłosić gotowości", () => {
    const s = apply(game.setup([A, B], rng), A, { type: "ready" });
    expect(game.validateMove(s, A, { type: "place", ships: FLEET })).toBe(false);
    expect(game.validateMove(s, A, { type: "ready" })).toBe(false);
    expect(game.validateMove(s, B, { type: "place", ships: FLEET })).toBe(true);
  });

  test("w rozstawianiu nie można strzelać", () => {
    const s = game.setup([A, B], rng);
    expect(game.validateMove(s, A, { type: "shoot", x: 0, y: 0 })).toBe(false);
  });

  test("bitwa startuje, gdy obaj są gotowi; strzela pierwszy gracz", () => {
    const s = battle();
    expect(view(s, A).phase).toBe("battle");
    expect(game.waitingFor(s)).toEqual([A]);
    expect(game.validateMove(s, A, { type: "place", ships: FLEET })).toBe(false);
  });

  test("ktoś spoza gry nie może nic zrobić", () => {
    const s = game.setup([A, B], rng);
    expect(game.validateMove(s, "obcy", { type: "ready" })).toBe(false);
    expect(game.validateMove(battle(), "obcy", { type: "shoot", x: 0, y: 5 })).toBe(false);
  });
});

describe("strzały", () => {
  test("pudło oddaje turę", () => {
    const s = shoot(battle(), A, 9, 0);
    expect(game.waitingFor(s)).toEqual([B]);
    expect(view(s, A).boards[B].shots).toContainEqual({ x: 9, y: 0, result: "miss" });
  });

  test("trafienie daje kolejny strzał", () => {
    const s = shoot(battle(), A, 0, 5);
    expect(game.waitingFor(s)).toEqual([A]);
    expect(view(s, A).boards[B].shots).toContainEqual({ x: 0, y: 5, result: "hit" });
  });

  test("strzał poza turą jest odrzucany", () => {
    expect(game.validateMove(battle(), B, { type: "shoot", x: 0, y: 0 })).toBe(false);
  });

  test("zatopienie odsłania statek i oznacza pola wokół, także po skosie", () => {
    const s = shoot(battle(), A, 3, 9); // jedynka B na (3,9)
    const board = view(s, A).boards[B];
    expect(board.ships).toEqual([{ x: 3, y: 9, length: 1, vertical: false }]);
    expect(board.shots).toContainEqual({ x: 3, y: 9, result: "sunk" });
    const around = board.shots.filter((sh) => sh.result === "around").map(key).sort();
    expect(around).toEqual(["2,8", "2,9", "3,8", "4,8", "4,9"].sort()); // y=10 jest poza planszą
    expect(game.waitingFor(s)).toEqual([A]);
  });

  test("zatopienie dłuższego statku oznacza wszystkie jego pola jako zatopione", () => {
    let s = battle();
    for (const c of cells(FLEET_B[0])) s = shoot(s, A, c.x, c.y);
    const board = view(s, A).boards[B];
    expect(board.shots.filter((sh) => sh.result === "sunk")).toHaveLength(4);
    expect(board.shots.filter((sh) => sh.result === "hit")).toHaveLength(0);
  });

  test("nie można strzelić dwa razy w to samo pole ani w pole oznaczone wokół zatopionego", () => {
    let s = shoot(battle(), A, 0, 5); // trafienie, A strzela dalej
    expect(game.validateMove(s, A, { type: "shoot", x: 0, y: 5 })).toBe(false);
    s = shoot(s, A, 3, 9); // zatopiona jedynka
    expect(game.validateMove(s, A, { type: "shoot", x: 2, y: 8 })).toBe(false);
  });

  test.each([
    { x: -1, y: 0 },
    { x: 0, y: SIZE },
    { x: SIZE, y: 0 },
    { x: 1.5, y: 1 },
  ])("strzał poza planszę jest odrzucany: %o", ({ x, y }) => {
    expect(game.validateMove(battle(), A, { type: "shoot", x, y })).toBe(false);
  });

  test("trafienia przeciwnika widać na własnej planszy", () => {
    let s = shoot(battle(), A, 9, 0); // pudło A, tura B
    s = shoot(s, B, 0, 0); // B trafia czwórkę A
    expect(view(s, A).boards[A].shots).toContainEqual({ x: 0, y: 0, result: "hit" });
    expect(view(s, A).boards[A].ships).toEqual(FLEET);
  });
});

describe("koniec gry", () => {
  test("zatopienie ostatniego statku wygrywa", () => {
    const beforeLast = sinkAll(battle(), allCells(FLEET_B).length - 1);
    expect(game.isOver(beforeLast)).toBeNull();
    const s = sinkAll(battle());
    expect(game.isOver(s)).toEqual({ winner: A });
    expect(game.waitingFor(s)).toEqual([]);
    expect(view(s, A).phase).toBe("over");
  });

  test("po końcu nikt nie strzela", () => {
    const s = sinkAll(battle());
    expect(game.validateMove(s, A, { type: "shoot", x: 9, y: 0 })).toBe(false);
    expect(game.validateMove(s, B, { type: "shoot", x: 9, y: 0 })).toBe(false);
  });
});

describe("ukrywanie informacji", () => {
  /** Pola statków `owner`, które `viewer` widzi w swoim widoku poza własną planszą. */
  function leaked(state: State, viewer: string, owner: string, fleet: Ship[]) {
    const v = view(state, viewer) as unknown as Record<string, unknown> & { boards: Record<string, unknown> };
    const { [viewer]: _own, ...others } = v.boards;
    const visible = new Set(coordsIn({ ...v, boards: others }));
    return allCells(fleet)
      .map(key)
      .filter((c) => visible.has(c));
  }

  test("na początku bitwy gracz nie widzi żadnego pola statków przeciwnika", () => {
    expect(leaked(battle(), A, B, FLEET_B)).toEqual([]);
    expect(leaked(battle(), B, A, FLEET)).toEqual([]);
  });

  test("w rozstawianiu gracz nie widzi floty przeciwnika", () => {
    const s = game.setup([A, B], rng);
    const enemyFleet = view(s, B).boards[B].ships;
    expect(leaked(s, A, B, enemyFleet)).toEqual([]);
  });

  test("trafienie odsłania tylko trafione pole", () => {
    const s = shoot(battle(), A, 0, 5); // trafienie w czwórkę B, niezatopiona
    expect(leaked(s, A, B, FLEET_B)).toEqual(["0,5"]);
    expect(view(s, A).boards[B].ships).toEqual([]);
  });

  test("zatopiony statek przeciwnika jest widoczny w całości", () => {
    let s = battle();
    for (const c of cells(FLEET_B[0])) s = shoot(s, A, c.x, c.y);
    expect(view(s, A).boards[B].ships).toEqual([FLEET_B[0]]);
  });

  test("obserwator nie widzi niezatopionych statków żadnej strony", () => {
    let s = shoot(battle(), A, 0, 5);
    expect(leaked(s, "", A, FLEET)).toEqual([]);
    expect(leaked(s, "", B, FLEET_B)).toEqual(["0,5"]);
    expect(view(s, "").boards[A].ships).toEqual([]);
    expect(view(s, "").boards[B].ships).toEqual([]);
  });
});

describe("tura i limit czasu", () => {
  test("waitingFor: obaj w rozstawianiu, potem niegotowy, w bitwie strzelający", () => {
    let s = game.setup([A, B], rng);
    expect([...game.waitingFor(s)].sort()).toEqual([A, B].sort());
    s = apply(s, A, { type: "ready" });
    expect(game.waitingFor(s)).toEqual([B]);
    s = apply(s, B, { type: "ready" });
    expect(game.waitingFor(s)).toEqual([A]);
  });

  test("po limicie w rozstawianiu gracz zgłasza gotowość z obecną flotą", () => {
    const s = game.setup([A, B], rng);
    const move = game.timeoutMove!(s, A, rng);
    expect(move).toEqual({ type: "ready" });
    expect(game.validateMove(s, A, move)).toBe(true);
  });

  test("po limicie w bitwie strzał jest dozwolony i trafia w nieznane pole", () => {
    const s = shoot(shoot(battle(), A, 0, 5), A, 3, 9); // trafienie i zatopiona jedynka
    for (let seed = 0; seed < 50; seed++) {
      const move = game.timeoutMove!(s, A, createRng(seed));
      expect(game.validateMove(s, A, move)).toBe(true);
    }
  });

  test("limit czasu tury jest ustawiony", () => {
    expect(game.turnSeconds).toBeGreaterThan(0);
  });
});

describe("stan", () => {
  test("applyMove nie zmienia poprzedniego stanu", () => {
    const before = battle();
    const snapshot = structuredClone(before);
    game.applyMove(before, A, { type: "shoot", x: 0, y: 5 }, rng);
    expect(before).toEqual(snapshot);
  });

  test("stan przeżywa zapis do JSON", () => {
    const s = shoot(battle(), A, 0, 5);
    const restored = JSON.parse(JSON.stringify(s));
    expect(game.validateMove(restored, A, { type: "shoot", x: 0, y: 5 })).toBe(false);
    expect(game.validateMove(restored, A, { type: "shoot", x: 1, y: 5 })).toBe(true);
  });

  test("schemat ruchu odrzuca śmieci z sieci", () => {
    expect(game.moveSchema.safeParse({ type: "shoot", x: 1, y: 2 }).success).toBe(true);
    expect(game.moveSchema.safeParse({ type: "ready" }).success).toBe(true);
    expect(game.moveSchema.safeParse({ type: "place", ships: FLEET }).success).toBe(true);
    expect(game.moveSchema.safeParse({ type: "shoot", x: "1", y: 2 }).success).toBe(false);
    expect(game.moveSchema.safeParse({ type: "fly" }).success).toBe(false);
    expect(game.moveSchema.safeParse({ type: "place", ships: "dużo" }).success).toBe(false);
  });
});
