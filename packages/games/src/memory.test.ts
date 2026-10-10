import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { memory as game, MODES, type Move, type State, SYMBOLS, type View } from "./memory.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 2-6 graczy, 60 s na odkrycie karty, tryby: mala 4×4 (8 par), srednia 4×6 (12 par, domyślna), duza 6×6 (18 par),
// - każdy symbol (0-17) leży dokładnie na dwóch kartach, układ losuje serwer,
// - ruch to { card }: odkrycie zakrytej karty; zaczyna players[0],
// - druga karta tury: para zostaje u gracza i daje kolejny ruch, pudło oddaje turę następnemu,
// - po pudle `miss` trzyma obie karty do następnego odkrycia,
// - koniec po zebraniu wszystkich par, wygrywa najwięcej par, remis na górze nie ma zwycięzcy,
// - widok (ten sam dla wszystkich) pokazuje symbole tylko kart zebranych, pierwszej karty tury i ostatniego pudła.

const A = "ania";
const B = "bartek";
const C = "celina";
const rng = createRng(1);

function send(state: State, player: string, move: Move): State {
  expect(game.validateMove(state, player, move), `${player}: ${JSON.stringify(move)}`).toBe(true);
  return game.applyMove(state, player, move, rng);
}

/** Pary kart (indeksy) jeszcze niezebrane, odczytane z układu w stanie. */
function pairsLeft(state: State): [number, number][] {
  const bySymbol = new Map<number, number[]>();
  state.cards.forEach((symbol, i) => {
    if (state.owner[i] === null) bySymbol.set(symbol, [...(bySymbol.get(symbol) ?? []), i]);
  });
  return [...bySymbol.values()] as [number, number][];
}

const turnOf = (state: State) => game.waitingFor(state)[0];

/** Gracz na ruchu zbiera parę. */
function hit(state: State): State {
  const [a, b] = pairsLeft(state)[0];
  const player = turnOf(state);
  return send(send(state, player, { card: a }), player, { card: b });
}

/** Gracz na ruchu odkrywa dwie różne karty. */
function miss(state: State): State {
  const [[a], [b]] = pairsLeft(state);
  const player = turnOf(state);
  return send(send(state, player, { card: a }), player, { card: b });
}

/** Partia, w której kolejni gracze zbierają podaną liczbę par (suma = wszystkie pary trybu). */
function playOut(players: string[], counts: number[], mode?: string): State {
  let state = game.setup(players, rng, mode);
  counts.forEach((n, seat) => {
    expect(turnOf(state)).toBe(players[seat]);
    for (let i = 0; i < n; i++) state = hit(state);
    if (seat < counts.length - 1) state = miss(state);
  });
  return state;
}

const view = (state: State, player = A) => game.playerView(state, player) as View;

describe("definicja gry", () => {
  test("gra dla 2-6 graczy z limitem 60 s", () => {
    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(6);
    expect(game.turnSeconds).toBe(60);
  });

  test("nowa gra nie jest skończona", () => {
    expect(game.isOver(game.setup([A, B], rng))).toBeNull();
  });

  test("trzy tryby, domyślny to średnia", () => {
    expect(game.modes).toBe(MODES);
    expect(MODES.map((m) => [m.id, m.cols, m.pairs])).toEqual([
      ["mala", 4, 8],
      ["srednia", 4, 12],
      ["duza", 6, 18],
    ]);
    expect(MODES.filter((m) => m.default).map((m) => m.id)).toEqual(["srednia"]);
  });
});

describe("setup", () => {
  test.each(MODES)("$id: każdy symbol leży dokładnie na dwóch kartach", (mode) => {
    const state = game.setup([A, B], createRng(3), mode.id);
    expect(state.cards).toHaveLength(mode.pairs * 2);
    expect(view(state).cols).toBe(mode.cols);
    const pairs = pairsLeft(state);
    expect(pairs).toHaveLength(mode.pairs);
    for (const pair of pairs) expect(pair).toHaveLength(2);
    for (const symbol of state.cards) {
      expect(Number.isInteger(symbol)).toBe(true);
      expect(symbol).toBeGreaterThanOrEqual(0);
      expect(symbol).toBeLessThan(SYMBOLS);
    }
  });

  test("brak trybu albo nieznany tryb to średnia", () => {
    expect(game.setup([A, B], rng).cards).toHaveLength(24);
    expect(game.setup([A, B], rng, "nie-ma").cards).toHaveLength(24);
  });

  test("ten sam seed daje ten sam układ, inny seed inny", () => {
    expect(game.setup([A, B], createRng(7))).toEqual(game.setup([A, B], createRng(7)));
    expect(game.setup([A, B], createRng(7)).cards).not.toEqual(game.setup([A, B], createRng(8)).cards);
  });

  test("zaczyna pierwszy gracz", () => {
    expect(game.waitingFor(game.setup([A, B, C], rng))).toEqual([A]);
  });
});

describe("walidacja", () => {
  const start = game.setup([A, B], rng);

  test("ktoś spoza gry nie może odkryć karty", () => {
    expect(game.validateMove(start, "obcy", { card: 0 })).toBe(false);
  });

  test("nie można ruszyć poza swoją turą", () => {
    expect(game.validateMove(start, B, { card: 0 })).toBe(false);
  });

  test("pierwsza i ostatnia karta przechodzą, indeksy obok nie", () => {
    const n = start.cards.length;
    expect(game.validateMove(start, A, { card: 0 })).toBe(true);
    expect(game.validateMove(start, A, { card: n - 1 })).toBe(true);
    expect(game.validateMove(start, A, { card: -1 })).toBe(false);
    expect(game.validateMove(start, A, { card: n })).toBe(false);
  });

  test("indeks niecałkowity odpada", () => {
    expect(game.validateMove(start, A, { card: 1.5 })).toBe(false);
  });

  test("nie można odkryć drugi raz pierwszej karty tury", () => {
    const state = send(start, A, { card: 0 });
    expect(game.validateMove(state, A, { card: 0 })).toBe(false);
  });

  test("nie można odkryć zebranej karty", () => {
    const [a, b] = pairsLeft(start)[0];
    const state = hit(start);
    expect(game.validateMove(state, A, { card: a })).toBe(false);
    expect(game.validateMove(state, A, { card: b })).toBe(false);
  });

  test("po końcu gry nikt nie może ruszyć", () => {
    const state = playOut([A, B], [5, 3], "mala");
    expect(game.isOver(state)).not.toBeNull();
    for (const p of [A, B]) for (let card = 0; card < state.cards.length; card++) expect(game.validateMove(state, p, { card })).toBe(false);
  });
});

describe("schemat ruchu", () => {
  test.each([[{ card: 3 }, true], [{ card: "3" }, false], [{}, false], [{ card: 1.5 }, false], [null, false], [{ card: null }, false]])(
    "%j → %s",
    (move, ok) => {
      expect(game.moveSchema.safeParse(move).success).toBe(ok);
    },
  );
});

describe("przebieg tury", () => {
  test("pierwsza karta tury zostaje odkryta, tura się nie zmienia", () => {
    const start = game.setup([A, B], rng);
    const state = send(start, A, { card: 5 });
    expect(view(state).first).toBe(5);
    expect(view(state).faces[5]).toBe(start.cards[5]);
    expect(game.waitingFor(state)).toEqual([A]);
  });

  test("para zostaje u gracza i daje kolejny ruch", () => {
    const start = game.setup([A, B], rng);
    const [a, b] = pairsLeft(start)[0];
    const state = hit(start);
    expect(view(state).owner[a]).toBe(A);
    expect(view(state).owner[b]).toBe(A);
    expect(view(state).first).toBeNull();
    expect(view(state).miss).toBeNull();
    expect(game.waitingFor(state)).toEqual([A]);
  });

  test("pudło oddaje turę następnemu graczowi", () => {
    const state = miss(game.setup([A, B], rng));
    expect(game.waitingFor(state)).toEqual([B]);
    expect(view(state).owner.every((o) => o === null)).toBe(true);
    expect(view(state).first).toBeNull();
  });

  test("przy trzech graczach kolejka się zawija", () => {
    let state = game.setup([A, B, C], rng);
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      order.push(turnOf(state));
      state = miss(state);
    }
    expect(order).toEqual([A, B, C, A]);
  });

  test("po pudle miss trzyma obie karty do następnego odkrycia", () => {
    const start = game.setup([A, B], rng);
    const [[a], [b]] = pairsLeft(start);
    const missed = miss(start);
    expect(view(missed).miss).toEqual([a, b]);
    const next = send(missed, B, { card: a });
    expect(view(next).miss).toBeNull();
  });

  test("kartę z pudła można odkryć od razu w następnej turze", () => {
    const start = game.setup([A, B], rng);
    const [[a, a2]] = pairsLeft(start);
    const state = send(send(miss(start), B, { card: a }), B, { card: a2 });
    expect(view(state).owner[a]).toBe(B);
  });
});

describe("ukrywanie stanu", () => {
  /** Indeksy kart, których symbol jest w widoku. */
  const shown = (state: State, player: string) => view(state, player).faces.flatMap((f, i) => (f === null ? [] : [i]));

  test.each([A, B, ""])("widok dla „%s” pokazuje tylko pierwszą kartę, pudło i zebrane pary", (viewer) => {
    const start = game.setup([A, B], rng);
    expect(shown(start, viewer)).toEqual([]);

    const first = send(start, A, { card: 2 });
    expect(shown(first, viewer)).toEqual([2]);

    const [[a], [b]] = pairsLeft(start);
    const missed = miss(start);
    expect(shown(missed, viewer)).toEqual([a, b].sort((x, y) => x - y));

    const [c, d] = pairsLeft(missed)[2];
    const afterHit = hit(send(send(missed, B, { card: c }), B, { card: d }));
    const owned = afterHit.owner.flatMap((o, i) => (o === null ? [] : [i]));
    expect(owned).toHaveLength(4);
    expect(shown(afterHit, viewer)).toEqual(owned);
  });

  test("odsłonięty symbol jest prawdziwy, a widok nie zawiera układu", () => {
    const state = miss(game.setup([A, B], rng));
    const v = view(state);
    v.faces.forEach((f, i) => f !== null && expect(f).toBe(state.cards[i]));
    expect("cards" in v).toBe(false);
  });
});

describe("koniec gry", () => {
  test("gra kończy się po zebraniu wszystkich par, wygrywa najwięcej par", () => {
    const state = playOut([A, B], [5, 3], "mala");
    expect(game.isOver(state)).toEqual({ winner: A, ranking: [A, B] });
    expect(game.waitingFor(state)).toEqual([]);
  });

  test("wygrać może też drugi gracz", () => {
    expect(game.isOver(playOut([A, B], [2, 6], "mala"))).toEqual({ winner: B, ranking: [B, A] });
  });

  test("gra nie kończy się, dopóki została choć jedna para", () => {
    let state = game.setup([A, B], rng, "mala");
    for (let i = 0; i < 7; i++) state = hit(state);
    expect(game.isOver(state)).toBeNull();
    expect(game.waitingFor(state)).toEqual([A]);
  });

  test("remis na pierwszym miejscu nie ma zwycięzcy", () => {
    const result = game.isOver(playOut([A, B], [4, 4], "mala"));
    expect(result?.winner).toBeUndefined();
    expect(result?.ranking).toHaveLength(2);
  });

  test("ranking trzech graczy idzie po liczbie par", () => {
    expect(game.isOver(playOut([A, B, C], [1, 5, 2], "mala"))).toEqual({ winner: B, ranking: [B, C, A] });
  });

  test("remis dwóch najlepszych przy trzech graczach nie ma zwycięzcy", () => {
    const result = game.isOver(playOut([A, B, C], [3, 3, 2], "mala"));
    expect(result?.winner).toBeUndefined();
    expect(result?.ranking?.[2]).toBe(C);
  });
});

describe("limit czasu", () => {
  test("ruch po limicie jest dozwolony, także z odkrytą pierwszą kartą", () => {
    let state = game.setup([A, B], rng, "mala");
    for (let i = 0; i < 5000 && !game.isOver(state); i++) {
      const player = turnOf(state);
      const move = game.timeoutMove!(state, player, rng);
      state = send(state, player, move);
    }
    expect(game.isOver(state)).not.toBeNull();
  });
});

describe("stan", () => {
  test("applyMove nie zmienia poprzedniego stanu", () => {
    const start = game.setup([A, B], rng);
    const copy = structuredClone(start);
    const first = send(start, A, { card: 0 });
    expect(start).toEqual(copy);
    const firstCopy = structuredClone(first);
    send(first, A, { card: 1 });
    expect(first).toEqual(firstCopy);
  });

  test("stan przeżywa zapis do JSON", () => {
    const state = hit(miss(game.setup([A, B], rng)));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
