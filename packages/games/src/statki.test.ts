import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { isValidFleet, MODES, type Move, randomFleet, type Ship, statki as game, type State, type View } from "./statki.ts";

// Testy napisane przed implementacją (etap 3). Ustalają zasady:
// - plansza 10×10, flota 1×4, 2×3, 3×2, 4×1, statki nie stykają się (także rogami),
// - na start flota losowa; w fazie rozstawiania można ją wymienić ruchem `place`, potem `ready`,
//   a `unready` cofa gotowość; całe rozstawianie ma jeden licznik 90 s, który się nie odnawia,
// - bitwa startuje, gdy obaj gotowi; strzela players[0]; trafienie = kolejny strzał, pudło oddaje turę,
// - zatopienie odsłania statek i oznacza pola wokół jako "around",
// - tryby (wybierane w lobby): klasyczny 10×10, hasbro 10×10 z flotą 5-4-3-3-2 i stykaniem (bez "around" po zatopieniu),
//   flota 12×12 z flotą 6-5-4-4-3-3-2-2, szybki 8×8 z flotą 4-3-2-2; testy bez podanego trybu dotyczą klasycznego,
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

  test("gotowość można cofnąć i wtedy znów przestawiać flotę", () => {
    let s = apply(game.setup([A, B], rng), A, { type: "ready" });
    s = apply(s, A, { type: "unready" });
    expect(view(s, B).boards[A].ready).toBe(false);
    expect([...game.waitingFor(s)].sort()).toEqual([A, B].sort());
    s = apply(s, A, { type: "place", ships: FLEET });
    expect(view(s, A).boards[A].ships).toEqual(FLEET);
    expect(view(s, A).phase).toBe("placing");
  });

  test("cofnąć gotowość może tylko gotowy gracz i tylko w rozstawianiu", () => {
    const s = game.setup([A, B], rng);
    expect(game.validateMove(s, A, { type: "unready" }), "niegotowy").toBe(false);
    expect(game.validateMove(apply(s, A, { type: "ready" }), B, { type: "unready" }), "gotowy jest ktoś inny").toBe(false);
    expect(game.validateMove(apply(s, A, { type: "ready" }), "obcy", { type: "unready" }), "obcy").toBe(false);
    expect(game.validateMove(battle(), A, { type: "unready" }), "bitwa").toBe(false);
    expect(game.validateMove(sinkAll(battle()), A, { type: "unready" }), "koniec").toBe(false);
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

  test("wygrywa też drugi gracz", () => {
    let s = shoot(battle(), A, 9, 5); // pudło A, tura B
    for (const c of allCells(FLEET)) s = shoot(s, B, c.x, c.y);
    expect(game.isOver(s)).toEqual({ winner: B });
    expect(view(s, "").shooter).toBeNull();
    // Po końcu przegrany dalej nie widzi niezatopionych statków zwycięzcy.
    expect(view(s, A).boards[B].ships).toEqual([]);
  });

  test("pole wokół zatopionego, w które już padło pudło, nie dostaje drugiego znacznika", () => {
    let s = shoot(battle(), A, 2, 8); // pudło tuż obok jedynki B na (3,9)
    s = shoot(s, B, 9, 1); // pudło B
    s = shoot(s, A, 3, 9); // zatopiona
    const at = view(s, A).boards[B].shots.filter((sh) => sh.x === 2 && sh.y === 8);
    expect(at).toEqual([{ x: 2, y: 8, result: "miss" }]);
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

describe("tryby", () => {
  const mode = (id: string) => MODES.find((m) => m.id === id)!;
  const start = (id?: string) => game.setup([A, B], createRng(7), id);
  /** Flota hasbro: piątka i czwórka stykają się bokiem, trójki rogiem. */
  const TOUCHING: Ship[] = [
    { x: 0, y: 0, length: 5, vertical: false },
    { x: 0, y: 1, length: 4, vertical: false },
    { x: 7, y: 5, length: 3, vertical: false },
    { x: 4, y: 6, length: 3, vertical: false },
    { x: 9, y: 8, length: 2, vertical: true },
  ];
  /** Reszta floty 12×12 (bez szóstki), w górnych rzędach z przerwami. */
  const FLOTA_REST: Ship[] = [
    { x: 0, y: 0, length: 5, vertical: false },
    { x: 6, y: 0, length: 4, vertical: false },
    { x: 0, y: 2, length: 4, vertical: false },
    { x: 5, y: 2, length: 3, vertical: false },
    { x: 9, y: 2, length: 3, vertical: false },
    { x: 0, y: 4, length: 2, vertical: false },
    { x: 3, y: 4, length: 2, vertical: false },
  ];
  /** Bitwa hasbro: obaj mają flotę TOUCHING. */
  function hasbroBattle(): State {
    let s = start("hasbro");
    for (const p of [A, B]) s = apply(s, p, { type: "place", ships: TOUCHING });
    return apply(apply(s, A, { type: "ready" }), B, { type: "ready" });
  }

  test("gra ogłasza cztery tryby od najkrótszej partii do najdłuższej, domyślny to klasyczny", () => {
    expect(game.modes!.map((m) => m.id)).toEqual(["szybki", "hasbro", "klasyczny", "flota"]);
    const cells = MODES.map((m) => m.lengths.reduce((a, b) => a + b));
    expect(cells).toEqual([...cells].sort((a, b) => a - b));
    expect(game.modes!.filter((m) => m.default).map((m) => m.id)).toEqual(["klasyczny"]);
    for (const m of game.modes!) expect(m.name.length > 0 && m.hint.length > 0, m.id).toBe(true);
  });

  test("bez trybu i z nieznanym trybem gra jest klasyczna", () => {
    for (const id of [undefined, "nie-ma", "constructor"]) {
      const v = view(start(id), A);
      expect(v.mode, String(id)).toBe("klasyczny");
      expect(v.size).toBe(10);
      expect(v.lengths).toEqual([4, 3, 3, 2, 2, 2, 1, 1, 1, 1]);
      expect(v.touching).toBe(false);
    }
  });

  test.each([
    ["szybki", 8, [4, 3, 2, 2], false],
    ["hasbro", 10, [5, 4, 3, 3, 2], true],
    ["flota", 12, [6, 5, 4, 4, 3, 3, 2, 2], false],
  ] as const)("%s: rozmiar, flota i stykanie w widoku każdego, losowa flota poprawna", (id, size, lengths, touching) => {
    const s = start(id);
    for (const viewer of [A, B, ""]) {
      const v = view(s, viewer);
      expect([v.mode, v.size, v.lengths, v.touching]).toEqual([id, size, lengths, touching]);
    }
    for (const p of [A, B]) {
      const ships = view(s, p).boards[p].ships;
      expect(ships.map((sh) => sh.length).sort((a, b) => b - a)).toEqual(lengths);
      expect(isValidFleet(ships, mode(id))).toBe(true);
    }
    for (let seed = 0; seed < 100; seed++) expect(isValidFleet(randomFleet(createRng(seed), mode(id)), mode(id)), `seed ${seed}`).toBe(true);
  });

  test("hasbro: statki mogą się stykać, ale nie nakładać", () => {
    const s = start("hasbro");
    expect(isValidFleet(TOUCHING, mode("klasyczny")), "to nie jest flota klasyczna").toBe(false);
    expect(game.validateMove(s, A, { type: "place", ships: TOUCHING })).toBe(true);
    const overlap = TOUCHING.map((sh, i) => (i === 1 ? { ...sh, y: 0 } : sh));
    expect(game.validateMove(s, A, { type: "place", ships: overlap })).toBe(false);
    expect(game.validateMove(s, A, { type: "place", ships: FLEET }), "flota klasyczna ma zły skład").toBe(false);
    expect(game.validateMove(start(), A, { type: "place", ships: TOUCHING }), "w klasycznym odrzucona").toBe(false);
  });

  test("hasbro: zatopienie nie oznacza pól wokół i można w nie strzelać", () => {
    const s = shoot(shoot(hasbroBattle(), A, 9, 8), A, 9, 9); // dwójka w rogu
    const shots = view(s, A).boards[B].shots;
    expect(shots).toEqual([
      { x: 9, y: 8, result: "sunk" },
      { x: 9, y: 9, result: "sunk" },
    ]);
    expect(view(s, A).boards[B].ships).toEqual([TOUCHING[4]]);
    expect(game.validateMove(s, A, { type: "shoot", x: 8, y: 8 }), "pole obok zatopionego").toBe(true);
    expect(game.waitingFor(s)).toEqual([A]);
  });

  test("hasbro: zatopienie całej stykającej się floty kończy grę", () => {
    let s = hasbroBattle();
    for (const c of allCells(TOUCHING)) s = shoot(s, A, c.x, c.y);
    expect(game.isOver(s)).toEqual({ winner: A });
  });

  test("flota: plansza 12×12, pola 10 i 11 są na planszy, 12 już nie", () => {
    const s = start("flota");
    const ships = view(s, A).boards[A].ships;
    const moved = (x: number, y: number) => ships.map((sh, i) => (i === 0 ? { ...sh, x, y, vertical: false } : sh));
    // Szóstka w ostatnim rzędzie i do ostatniej kolumny: poprawność zależy tylko od reszty floty, więc sprawdzamy samą planszę.
    expect(isValidFleet([{ x: 6, y: 11, length: 6, vertical: false }, ...FLOTA_REST], mode("flota"))).toBe(true);
    expect(isValidFleet([{ x: 7, y: 11, length: 6, vertical: false }, ...FLOTA_REST], mode("flota"))).toBe(false);
    expect(game.validateMove(s, A, { type: "place", ships: moved(7, 11) }), "wystaje za kolumnę 11").toBe(false);
    let b = apply(apply(s, A, { type: "ready" }), B, { type: "ready" });
    expect(game.validateMove(b, A, { type: "shoot", x: 11, y: 11 })).toBe(true);
    expect(game.validateMove(b, A, { type: "shoot", x: 12, y: 0 })).toBe(false);
    expect(game.validateMove(b, A, { type: "shoot", x: 0, y: 12 })).toBe(false);
    expect(game.validateMove(battle(), A, { type: "shoot", x: 10, y: 0 }), "klasyczny kończy się na 9").toBe(false);
    b = shoot(b, A, 11, 11);
    expect(view(b, A).boards[B].shots).toHaveLength(1);
  });

  test("szybki: plansza 8×8 kończy się na polu 7, statki dalej nie mogą się stykać", () => {
    const quick: Ship[] = [
      { x: 4, y: 7, length: 4, vertical: false },
      { x: 0, y: 0, length: 3, vertical: false },
      { x: 0, y: 2, length: 2, vertical: false },
      { x: 3, y: 2, length: 2, vertical: false },
    ];
    expect(isValidFleet(quick, mode("szybki"))).toBe(true);
    expect(isValidFleet(quick.map((sh, i) => (i === 0 ? { ...sh, x: 5 } : sh)), mode("szybki")), "wystaje").toBe(false);
    expect(isValidFleet(quick.map((sh, i) => (i === 3 ? { ...sh, x: 2 } : sh)), mode("szybki")), "styk").toBe(false);
    let s = start("szybki");
    s = apply(apply(s, A, { type: "ready" }), B, { type: "ready" });
    expect(game.validateMove(s, A, { type: "shoot", x: 7, y: 7 })).toBe(true);
    expect(game.validateMove(s, A, { type: "shoot", x: 8, y: 0 })).toBe(false);
  });

  test.each(["klasyczny", "szybki", "hasbro", "flota"])("%s: ruch po limicie czasu jest dozwolony w obu fazach", (id) => {
    let s = start(id);
    for (const p of [A, B]) s = apply(s, p, game.timeoutMove!(s, p, rng));
    expect(view(s, A).phase).toBe("battle");
    for (let seed = 0; seed < 30; seed++) {
      const move = game.timeoutMove!(s, A, createRng(seed));
      expect(game.validateMove(s, A, move), JSON.stringify(move)).toBe(true);
    }
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

  test("licznik: całe rozstawianie ma jeden limit 90 s, w bitwie każdy strzał daje nowe 60 s", () => {
    const key = (s: State) => game.turn!(s).key;
    let s = game.setup([A, B], rng);
    expect(game.turn!(s).seconds).toBe(90);
    const start = key(s);
    s = apply(s, A, { type: "place", ships: FLEET });
    expect(key(s), "przestawienie").toBe(start);
    s = apply(s, A, { type: "ready" });
    expect(key(s), "gotowość").toBe(start);
    s = apply(s, A, { type: "unready" });
    expect(key(s), "cofnięcie gotowości nie przedłuża czasu").toBe(start);
    s = apply(s, A, { type: "ready" });
    s = apply(s, B, { type: "place", ships: FLEET_B });
    expect(key(s), "ostatni niegotowy nie przedłuża sobie czasu").toBe(start);
    expect(game.turn!(s).seconds).toBe(90);
    s = apply(s, B, { type: "ready" });
    const battleStart = key(s);
    expect(battleStart).not.toBe(start);
    expect(game.turn!(s).seconds).toBe(game.turnSeconds);
    s = shoot(s, A, 0, 5); // trafienie: ten sam gracz, nowy limit
    const afterHit = key(s);
    expect(afterHit).not.toBe(battleStart);
    s = shoot(s, A, 9, 0); // pudło
    expect(key(s)).not.toBe(afterHit);
    expect(game.turn!(sinkAll(battle())).seconds).toBe(0);
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
    expect(game.moveSchema.safeParse({ type: "unready" }).success).toBe(true);
    expect(game.moveSchema.safeParse({ type: "place", ships: FLEET }).success).toBe(true);
    expect(game.moveSchema.safeParse({ type: "shoot", x: "1", y: 2 }).success).toBe(false);
    expect(game.moveSchema.safeParse({ type: "fly" }).success).toBe(false);
    expect(game.moveSchema.safeParse({ type: "place", ships: "dużo" }).success).toBe(false);
  });
});
