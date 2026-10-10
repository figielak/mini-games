import { describe, expect, test } from "vitest";
import { createRng, type Rng } from "./core.ts";
import { ALLOWANCE, BOARD, buildCost, CARDS, CHARACTERS, kampusTour as game, type Move, ROUNDS, SIZE, SEAT_BONUS, START_CASH, type State, type View } from "./kampus-tour.ts";

// Testy napisane przed implementacją. Ustalają zasady Kampus Tour:
// - 2-4 graczy, plansza 32 pól, wszyscy startują na polu 0 (Początek) z 200 zł, każde dalsze miejsce +20 zł
//   (wyrównanie przewagi pierwszego ruchu),
// - rzut dwiema kośćmi: Math.floor(rng() * 6) + 1 dwa razy, ruch o sumę,
// - przejście przez pole 0 dolicza okrążenie i 20 zł kieszonkowego,
// - wolne pole można kupić (jeśli stać) albo pominąć; na cudzym płaci się czynsz P/10, za całą grupę ×2,
// - Ksero i Stołówka (jak wodociągi): czynsz = suma oczek × 2 zł, a gdy właściciel ma oba × 5 zł,
// - pole 28 (Opłata za akademik) kosztuje 15 zł,
// - brak gotówki: sprzedaż pól bankowi za połowę ceny, a gdy to nie wystarczy, bankructwo,
// - dublet daje kolejny rzut; trzeci dublet z rzędu wysyła na Kolokwium (bez ruchu),
// - Kolokwium: najwyżej 1 tura; w swojej turze dublet = wyjście i ruch (bez dodatkowego rzutu),
//   bez dubletu tura przerwy; karta Zaliczenie wyprowadza automatycznie,
// - Karty Dziekanatu: talia 18 kart, dobrana karta wraca na spód (Zaliczenie zostaje u gracza do użycia),
// - budowa tylko na swoim polu po staniu na nim (także zaraz po kupnie), dowolnie wiele poziomów naraz;
//   poziomy 1-3 kosztują P/2, landmark (4) P i wymaga kompletu; czynsz 0,4P / P / 2P / 4P,
// - sprzedaż przy długu: pole z budynkami za połowę (cena + budynki),
// - Juwenalia: kto stanie na rogu, wybiera swoje pole; czynsz na nim ×2, przy kolejnych Juwenaliach ×3, ×4…
//   (jedno pole naraz, nowy wybór przenosi Juwenalia),
// - Bilet MPK: stanięcie kończy turę; w następnej zamiast rzutu można pojechać na dowolne pole,
// - wykupienie: po zapłaceniu czynszu cudze pole można odkupić za 2× wartość (bez landmarków),
// - monopol: 3 pełne grupy kolorów kończą grę wygraną,
// - koniec, gdy zostanie jeden gracz albo po ROUNDS rundach (ranking wg majątku: gotówka + ceny pól),
// - na starcie każdy wybiera postać (pionek), wszyscy naraz; postaci się nie powtarzają; po limicie czasu losowa wolna.

const A = "ania";
const B = "bartek";
const C = "celina";

/** Kostka sterowana w testach: kolejne wywołania dają zadane oczka. */
function dice(...rolls: number[]): Rng {
  let i = 0;
  return () => {
    if (i >= rolls.length) throw new Error("test nie przewidział tylu rzutów");
    return (rolls[i++] - 1) / 6 + 0.001;
  };
}

const view = (s: State) => game.playerView(s, A) as View;

function play(s: State, player: string, move: Move, rng: Rng = dice()): State {
  expect(game.validateMove(s, player, move), `${player}: ${JSON.stringify(move)}`).toBe(true);
  return game.applyMove(s, player, move, rng);
}

const roll = (s: State, player: string, a: number, b: number) => play(s, player, { type: "roll" }, dice(a, b));

/** Stan po setupie i wyborze postaci (gracz i dostaje postać i), z równą gotówką: testy zasad liczą od START_CASH bez premii za miejsce. */
const even = (s: State): State => ({
  ...s,
  phase: "roll",
  characters: Object.fromEntries(s.players.map((p, i) => [p, i])),
  cash: Object.fromEntries(s.players.map((p) => [p, START_CASH])),
});
const two = () => even(game.setup([A, B], createRng(1)));
const three = () => even(game.setup([A, B, C], createRng(1)));

/** Stan z nadpisaną gotówką, właścicielami i pozycjami. */
function with2(
  s: State,
  patch: Partial<
    Pick<State, "cash" | "owners" | "positions" | "round" | "levels" | "deck" | "kolokwium" | "passes" | "juwenalia" | "festivals" | "mpk">
  >,
): State {
  return {
    ...s,
    juwenalia: patch.juwenalia !== undefined ? patch.juwenalia : s.juwenalia,
    festivals: patch.festivals ?? s.festivals,
    mpk: patch.mpk ?? s.mpk,
    deck: patch.deck ?? s.deck,
    kolokwium: patch.kolokwium ?? s.kolokwium,
    passes: { ...s.passes, ...patch.passes },
    levels: { ...s.levels, ...patch.levels },
    cash: { ...s.cash, ...patch.cash },
    owners: { ...s.owners, ...patch.owners },
    positions: { ...s.positions, ...patch.positions },
    round: patch.round ?? s.round,
  };
}

/** Numer karty po tytule. */
function card(title: string): number {
  const i = CARDS.findIndex((c) => c.title === title);
  if (i < 0) throw new Error(`nie ma karty „${title}”`);
  return i;
}

/** Talia z zadaną kartą na wierzchu. */
const top = (s: State, title: string): State => ({ ...s, deck: [card(title), ...s.deck.filter((c) => c !== card(title))] });

const price = (tile: number) => {
  const t = BOARD[tile];
  if (t.kind !== "property") throw new Error(`pole ${tile} nie jest do kupienia`);
  return t.price;
};

describe("plansza", () => {
  test("32 pola, rogi na 0, 11, 16, 27", () => {
    expect(SIZE).toBe(32);
    expect(BOARD).toHaveLength(32);
    expect(BOARD[0].kind).toBe("start");
    expect(BOARD[11].kind).toBe("kolokwium");
    expect(BOARD[16].kind).toBe("juwenalia");
    expect(BOARD[27].kind).toBe("mpk");
  });

  test("3 pola Karty Dziekanatu i Opłata za akademik na 28", () => {
    expect([5, 13, 21].map((i) => BOARD[i].kind)).toEqual(["karty", "karty", "karty"]);
    expect(BOARD[28]).toEqual({ kind: "tax", name: "Opłata za akademik", amount: 15 });
  });

  test("8 grup z nazwami, cenami rosnącymi wzdłuż planszy; skrajne grupy po 2 pola", () => {
    const groups = [
      [10, [1, "Automat z kawą"], [2, "Automat z przekąskami"]],
      [15, [3, "Biblioteka PRz"], [4, "Hala sportowa PRz"], [6, "Rektorat"]],
      [20, [8, "Wydział Mechaniczny"], [9, "Wydział Elektryczny"], [10, "Wydział Chemiczny"]],
      [25, [12, "Hala Podpromie"], [14, "Stadion Stali"], [15, "Zalew Rzeszowski"]],
      [30, [17, "Ulica 3 Maja"], [18, "Galeria Rzeszów"], [19, "Millenium Hall"]],
      [35, [20, "Kino"], [22, "Kręgielnia"], [23, "Klub studencki"]],
      [40, [24, "Bulwary nad Wisłokiem"], [25, "Okrągła kładka"], [26, "Pomnik Czynu Rewolucyjnego"]],
      [50, [30, "Zamek Lubomirskich"], [31, "Rynek"]],
    ] as const;
    groups.forEach(([price, ...tiles], group) => {
      for (const [i, name] of tiles) expect(BOARD[i], `pole ${i}`).toEqual({ kind: "property", name, group, price });
    });
    expect(BOARD.filter((t) => t.kind === "property")).toHaveLength(22);
  });

  test("Ksero (7) i Stołówka (29) jak wodociągi, po 30 zł", () => {
    expect(BOARD[7]).toEqual({ kind: "utility", name: "Ksero", price: 30 });
    expect(BOARD[29]).toEqual({ kind: "utility", name: "Stołówka", price: 30 });
  });

  test("wszystkie pola do kupienia razem kosztują 675 zł", () => {
    const total = BOARD.reduce((sum, t) => sum + (t.kind === "property" || t.kind === "utility" ? t.price : 0), 0);
    expect(total).toBe(675);
  });
});

describe("setup", () => {
  test.each([2, 3, 4])("%i graczy: wszyscy na starcie, 200 zł + 20 zł za każde dalsze miejsce, rzuca pierwszy", (n) => {
    const players = [A, B, C, "darek"].slice(0, n);
    const s = game.setup(players, createRng(1));
    const v = view(s);
    players.forEach((p, i) => {
      expect(v.positions[p]).toBe(0);
      expect(v.laps[p]).toBe(0);
      expect(v.cash[p]).toBe(START_CASH + SEAT_BONUS * i);
    });
    expect(START_CASH).toBe(200);
    expect(SEAT_BONUS).toBe(20);
    expect(v.owners).toEqual({});
    // Najpierw wszyscy naraz wybierają postać.
    expect(v.phase).toBe("pick");
    expect(v.characters).toEqual({});
    expect(game.waitingFor(s)).toEqual(players);
    expect(v.turn).toBe(A);
    expect(v.round).toBe(1);
    expect(v.dice).toBeNull();
  });

  test("gra dla 2-4 graczy, do wyboru 6 postaci", () => {
    expect(CHARACTERS).toHaveLength(6);
    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(4);
  });
});

describe("rzut i ruch", () => {
  test("rzuca tylko gracz na turze", () => {
    expect(game.validateMove(two(), B, { type: "roll" })).toBe(false);
    expect(game.validateMove(two(), "obcy", { type: "roll" })).toBe(false);
  });

  test("ruch o sumę oczek, wynik widać w widoku, tura przechodzi dalej", () => {
    const s = roll(two(), A, 5, 6); // pole 11: Kolokwium w odwiedzinach, bez efektu
    expect(view(s).positions[A]).toBe(11);
    expect(view(s).dice).toEqual([5, 6]);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("przejście przez start: okrążenie i 40 zł kieszonkowego", () => {
    const s = roll(with2(two(), { positions: { [A]: 27 } }), A, 2, 3);
    expect(view(s).positions[A]).toBe(0);
    expect(view(s).laps[A]).toBe(1);
    expect(view(s).cash[A]).toBe(START_CASH + ALLOWANCE);
    expect(ALLOWANCE).toBe(40);
  });

  test("dublet daje kolejny rzut (po decyzji o kupnie)", () => {
    let s = roll(two(), A, 1, 1);
    expect(view(s).phase).toBe("buy");
    s = play(s, A, { type: "skip" });
    expect(game.waitingFor(s)).toEqual([A]);
    expect(view(s).phase).toBe("roll");
  });

  test("trzeci dublet z rzędu: prosto na Kolokwium, bez ruchu, koniec tury", () => {
    // Za 5 zł nic się nie kupi, więc nie ma fazy kupna.
    let s = with2(two(), { cash: { [A]: 5 } });
    s = roll(s, A, 1, 1);
    s = roll(s, A, 2, 2);
    s = roll(s, A, 3, 3);
    expect(view(s).positions[A]).toBe(11);
    expect(view(s).kolokwium).toEqual([A]);
    expect(view(s).events.at(-1)).toEqual({ type: "kolokwium", player: A });
    expect(game.waitingFor(s)).toEqual([B]);
    // Licznik dubletów zeruje się dla kolejnego gracza.
    s = roll(with2(s, { cash: { [B]: 5 } }), B, 1, 1);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("po ostatnim graczu zaczyna się kolejna runda", () => {
    let s = roll(two(), A, 5, 6);
    expect(view(s).round).toBe(1);
    s = roll(s, B, 5, 6);
    expect(view(s).round).toBe(2);
    expect(game.waitingFor(s)).toEqual([A]);
  });
});

describe("kupno", () => {
  test("wolne pole: kupno odejmuje cenę i daje własność", () => {
    let s = roll(two(), A, 1, 2);
    expect(view(s).phase).toBe("buy");
    expect(game.waitingFor(s)).toEqual([A]);
    expect(game.validateMove(s, B, { type: "buy" })).toBe(false);
    expect(game.validateMove(s, A, { type: "roll" })).toBe(false);
    s = play(s, A, { type: "buy" });
    expect(view(s).owners[3]).toBe(A);
    expect(view(s).cash[A]).toBe(START_CASH - price(3));
    // Po kupnie od razu można budować; pominięcie oddaje turę.
    expect(view(s).phase).toBe("build");
    s = play(s, A, { type: "skip" });
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("pominięcie zostawia pole wolne", () => {
    let s = roll(two(), A, 1, 2);
    s = play(s, A, { type: "skip" });
    expect(view(s).owners[3]).toBeUndefined();
    expect(view(s).cash[A]).toBe(START_CASH);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("bez pieniędzy na pole nie ma fazy kupna", () => {
    const s = roll(with2(two(), { cash: { [A]: 9 } }), A, 1, 2);
    expect(view(s).owners[3]).toBeUndefined();
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("kupić i pominąć można tylko w fazie kupna", () => {
    expect(game.validateMove(two(), A, { type: "buy" })).toBe(false);
    expect(game.validateMove(two(), A, { type: "skip" })).toBe(false);
  });
});

describe("czynsz i opłaty", () => {
  test("cudze pole: czynsz P/10 dla właściciela", () => {
    const s = roll(with2(two(), { owners: { 4: B } }), A, 1, 3);
    expect(view(s).cash[A]).toBe(START_CASH - 2); // 15 / 10, zaokrąglone
    expect(view(s).cash[B]).toBe(START_CASH + 2);
    expect(view(s).phase).toBe("buyout");
  });

  test("cała grupa w rękach właściciela: czynsz ×2", () => {
    const s = roll(with2(two(), { owners: { 3: B, 4: B, 6: B } }), A, 1, 3);
    expect(view(s).cash[A]).toBe(START_CASH - 4);
    expect(view(s).cash[B]).toBe(START_CASH + 4);
  });

  test("własne pole: bez czynszu i bez kupna, za to budowa", () => {
    const s = roll(with2(two(), { owners: { 4: A } }), A, 1, 3);
    expect(view(s).cash[A]).toBe(START_CASH);
    expect(view(s).phase).toBe("build");
  });

  test("grupa z 2 pól: oba w rękach właściciela to czynsz ×2", () => {
    const s = roll(with2(two(), { owners: { 30: B, 31: B }, positions: { [A]: 26 } }), A, 1, 3);
    expect(view(s).cash[A]).toBe(START_CASH - 10);
  });

  test("Ksero: czynsz to suma oczek × 2 zł", () => {
    const s = roll(with2(two(), { owners: { 7: B } }), A, 3, 4);
    expect(view(s).positions[A]).toBe(7);
    expect(view(s).cash[A]).toBe(START_CASH - 14);
    expect(view(s).cash[B]).toBe(START_CASH + 14);
  });

  test("Ksero i Stołówka u jednego właściciela: suma oczek × 5 zł", () => {
    const s = roll(with2(two(), { owners: { 7: B, 29: B } }), A, 3, 4);
    expect(view(s).cash[A]).toBe(START_CASH - 35);
  });

  test("Ksero można kupić za 30 zł", () => {
    let s = roll(two(), A, 3, 4);
    expect(view(s).phase).toBe("buy");
    s = play(s, A, { type: "buy" });
    expect(view(s).owners[7]).toBe(A);
    expect(view(s).cash[A]).toBe(START_CASH - 30);
  });

  test("Opłata za akademik: 15 zł dla banku", () => {
    const s = roll(with2(two(), { positions: { [A]: 25 } }), A, 1, 2);
    expect(view(s).positions[A]).toBe(28);
    expect(view(s).cash[A]).toBe(START_CASH - 15);
    expect(view(s).cash[B]).toBe(START_CASH);
  });
});

describe("długi i bankructwo", () => {
  test("brak gotówki: sprzedaż pól bankowi za połowę ceny, potem spłata", () => {
    let s = with2(two(), { cash: { [A]: 3 }, owners: { 1: A, 29: A, 3: B, 4: B, 6: B } });
    s = roll(s, A, 1, 3); // czynsz 4 zł, A ma 3 zł
    expect(view(s).phase).toBe("sell");
    expect(view(s).debt).toEqual({ amount: 4, to: [B] });
    expect(game.waitingFor(s)).toEqual([A]);
    expect(game.validateMove(s, A, { type: "sell", tile: 4 }), "cudzego pola nie sprzeda").toBe(false);
    expect(game.validateMove(s, A, { type: "roll" })).toBe(false);

    s = play(s, A, { type: "sell", tile: 1 }); // +5 zł
    expect(view(s).owners[1]).toBeUndefined();
    expect(view(s).owners[29]).toBe(A);
    expect(view(s).cash[A]).toBe(3 + 5 - 4);
    expect(view(s).cash[B]).toBe(START_CASH + 4);
    expect(view(s).debt).toBeNull();
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("gdy nawet sprzedaż nie wystarczy: bankructwo, gotówka dla wierzyciela", () => {
    const s = roll(with2(two(), { cash: { [A]: 1 }, owners: { 3: B, 4: B, 6: B } }), A, 1, 3);
    expect(view(s).cash[B]).toBe(START_CASH + 1);
    expect(view(s).bankrupt).toEqual([A]);
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A] });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test("bankrut traci pola i jest pomijany w kolejce", () => {
    // Czynsz za pełną grupę 50 zł to 10 zł; A ma 1 zł i pole warte 5 zł przy sprzedaży.
    let s = with2(three(), { cash: { [A]: 1 }, owners: { 1: A, 30: B, 31: B }, positions: { [A]: 26 } });
    s = roll(s, A, 1, 3);
    expect(view(s).positions[A]).toBe(30);
    expect(view(s).bankrupt).toEqual([A]);
    expect(view(s).owners[1]).toBeUndefined();
    expect(game.isOver(s)).toBeNull();
    expect(game.waitingFor(s)).toEqual([B]);
    s = roll(s, B, 5, 6);
    s = roll(s, C, 5, 6);
    expect(game.waitingFor(s)).toEqual([B]);
    expect(view(s).round).toBe(2);
  });
});

describe("bankructwo: przypadki brzegowe", () => {
  test("bankructwo przez opłatę: gotówka przepada w banku", () => {
    const s = roll(with2(two(), { cash: { [A]: 1 }, positions: { [A]: 24 } }), A, 1, 3); // Opłata za akademik 15 zł
    expect(view(s).bankrupt).toEqual([A]);
    expect(view(s).cash).toEqual({ [A]: 0, [B]: START_CASH });
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A] });
  });

  test("dług równy gotówce to nie bankructwo ani sprzedaż", () => {
    const s = roll(with2(two(), { cash: { [A]: 15 }, positions: { [A]: 24 } }), A, 1, 3);
    expect(view(s).cash[A]).toBe(0);
    expect(view(s).bankrupt).toEqual([]);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("dwa bankructwa: wygrywa ostatni żywy, bankruci w rankingu od ostatniego", () => {
    let s = with2(three(), { cash: { [A]: 1, [B]: 1 }, owners: { 30: C, 31: C }, positions: { [A]: 26, [B]: 26 } });
    s = roll(s, A, 1, 3);
    expect(game.isOver(s)).toBeNull();
    s = roll(s, B, 1, 3);
    expect(view(s).bankrupt).toEqual([A, B]);
    expect(view(s).cash[C]).toBe(START_CASH + 2);
    expect(game.isOver(s)).toEqual({ winner: C, ranking: [C, B, A] });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test("sprzedaż kilku pól po kolei, aż starczy na dług", () => {
    // Czynsz na Rynku z kompletem: 10 zł; A ma 1 zł i dwa pola po 5 zł ze sprzedaży.
    let s = with2(two(), { cash: { [A]: 1 }, owners: { 1: A, 2: A, 30: B, 31: B }, positions: { [A]: 26 } });
    s = roll(s, A, 1, 3);
    s = play(s, A, { type: "sell", tile: 1 });
    expect(view(s).phase).toBe("sell");
    expect(view(s).debt).toEqual({ amount: 10, to: [B] });
    s = play(s, A, { type: "sell", tile: 2 });
    expect(view(s).cash).toEqual({ [A]: 1, [B]: START_CASH + 10 });
    expect(view(s).bankrupt).toEqual([]);
    expect(game.waitingFor(s)).toEqual([B]);
  });
});

describe("historia zdarzeń", () => {
  test("ostatnie zdarzenia zostają po kolejnych ruchach, najwyżej 4", () => {
    let s = roll(two(), A, 1, 2); // A na 3
    s = play(s, A, { type: "buy" });
    s = play(s, A, { type: "skip" }); // bez budowy: pominięcie budowy nie jest zdarzeniem
    s = roll(s, B, 5, 6); // B na Kolokwium w odwiedzinach: brak nowego zdarzenia
    expect(view(s).events).toEqual([{ type: "buy", player: A, amount: 15, tile: 3 }]);
    s = roll(s, A, 1, 3); // A na 7 (Ksero)
    s = play(s, A, { type: "skip" });
    expect(view(s).events.at(-1)).toEqual({ type: "skip", player: A, tile: 7 });

    for (let i = 0; i < 4; i++) s = { ...s, events: [...s.events, { type: "allowance", player: B, amount: 20 }] };
    s = roll(s, B, 1, 2); // B z 11 na 14: Stadion Stali, faza kupna
    s = play(s, B, { type: "buy" });
    expect(view(s).events).toHaveLength(4);
    expect(view(s).events.at(-1)).toEqual({ type: "buy", player: B, amount: 25, tile: 14 });
  });
});

describe("komplet grupy", () => {
  test("kupno ostatniego pola grupy daje zdarzenie kompletu", () => {
    let s = with2(two(), { owners: { 30: A }, positions: { [A]: 26 } });
    s = roll(s, A, 2, 3); // 31: Rynek
    s = play(s, A, { type: "buy" });
    expect(view(s).events.at(-1)).toEqual({ type: "set", player: A, tile: 31 });
    expect(view(s).events.at(-2)).toEqual({ type: "buy", player: A, amount: 50, tile: 31 });
  });

  test("Ksero i Stołówka u jednego gracza to też komplet", () => {
    let s = with2(two(), { owners: { 29: A } });
    s = roll(s, A, 3, 4); // 7: Ksero
    s = play(s, A, { type: "buy" });
    expect(view(s).events.at(-1)).toEqual({ type: "set", player: A, tile: 7 });
  });

  test("bez pełnej grupy nie ma zdarzenia kompletu", () => {
    let s = with2(two(), { owners: { 30: B }, positions: { [A]: 26 } });
    s = roll(s, A, 2, 3);
    s = play(s, A, { type: "buy" });
    expect(view(s).events.at(-1)?.type).toBe("buy");
  });
});

describe("budowanie", () => {
  // Pole 17 (Ulica 3 Maja, grupa 17-18-19) kosztuje 30 zł: poziom 15 zł, landmark 30 zł. Domyślnie z kompletem.
  const onOwn = (patch: Parameters<typeof with2>[1] = {}) =>
    roll(with2(two(), { owners: { 17: A, 18: A, 19: A }, positions: { [A]: 14 }, ...patch }), A, 1, 2);

  test("koszt budowy: poziomy po P/2, landmark P", () => {
    expect(buildCost(17, 0, 1)).toBe(15);
    expect(buildCost(17, 0, 3)).toBe(45);
    expect(buildCost(17, 3, 4)).toBe(30);
    expect(buildCost(4, 0, 1)).toBe(8); // 15 / 2, zaokrąglone
  });

  test("kilka poziomów naraz: płaci się sumę", () => {
    let s = onOwn();
    expect(view(s).phase).toBe("build");
    expect(game.waitingFor(s)).toEqual([A]);
    s = play(s, A, { type: "build", level: 3 });
    expect(view(s).levels[17]).toBe(3);
    expect(view(s).cash[A]).toBe(START_CASH - 45);
    expect(view(s).events.at(-1)).toEqual({ type: "build", player: A, tile: 17, level: 3, amount: 45 });
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("dobudowa od obecnego poziomu; poziom nie wyższy niż obecny jest odrzucany", () => {
    const s = onOwn({ levels: { 17: 2 } });
    expect(game.validateMove(s, A, { type: "build", level: 2 })).toBe(false);
    expect(game.validateMove(s, A, { type: "build", level: 1 })).toBe(false);
    const built = play(s, A, { type: "build", level: 3 });
    expect(view(built).cash[A]).toBe(START_CASH - 15);
  });

  test("bez kompletu do poziomu 2, poziom 3 i landmark z kompletem grupy", () => {
    const alone = onOwn({ owners: { 17: A } });
    expect(game.validateMove(alone, A, { type: "build", level: 2 })).toBe(true);
    expect(game.validateMove(alone, A, { type: "build", level: 3 })).toBe(false);
    // Na poziomie 2 bez kompletu nie ma czego budować: tura idzie dalej.
    expect(game.waitingFor(onOwn({ owners: { 17: A }, levels: { 17: 2 } }))).toEqual([B]);

    let s = onOwn({ levels: { 17: 3 } });
    s = play(s, A, { type: "build", level: 4 });
    expect(view(s).levels[17]).toBe(4);
    expect(view(s).cash[A]).toBe(START_CASH - 30);
  });

  test("budowa ponad stan gotówki jest odrzucana; bez pieniędzy nie ma fazy budowy", () => {
    const s = onOwn({ cash: { [A]: 20 } });
    expect(game.validateMove(s, A, { type: "build", level: 1 })).toBe(true);
    expect(game.validateMove(s, A, { type: "build", level: 2 })).toBe(false);
    expect(game.waitingFor(onOwn({ cash: { [A]: 14 } }))).toEqual([B]);
  });

  test("po kupnie od razu można budować", () => {
    let s = roll(with2(two(), { positions: { [A]: 14 } }), A, 1, 2);
    s = play(s, A, { type: "buy" });
    s = play(s, A, { type: "build", level: 1 });
    expect(view(s).levels[17]).toBe(1);
    expect(view(s).cash[A]).toBe(START_CASH - 30 - 15);
  });

  test("Ksero, Stołówka i Akademik bez budowy", () => {
    expect(game.waitingFor(roll(with2(two(), { owners: { 7: A } }), A, 3, 4))).toEqual([B]);
    expect(game.waitingFor(play(roll(two(), A, 3, 4), A, { type: "buy" }))).toEqual([B]);
  });

  test("budować można tylko w fazie budowy", () => {
    expect(game.validateMove(two(), A, { type: "build", level: 1 })).toBe(false);
  });

  test("pominięcie budowy po dublecie daje kolejny rzut", () => {
    let s = roll(with2(two(), { owners: { 17: A }, positions: { [A]: 15 } }), A, 1, 1);
    expect(view(s).phase).toBe("build");
    s = play(s, A, { type: "skip" });
    expect(view(s).phase).toBe("roll");
    expect(game.waitingFor(s)).toEqual([A]);
  });

  test.each([
    [1, 12],
    [2, 30],
    [3, 60],
    [4, 120],
  ])("czynsz na poziomie %i: %i zł (komplet go nie podwaja)", (level, amount) => {
    const s = roll(with2(two(), { owners: { 17: B, 18: B, 19: B }, levels: { 17: level }, positions: { [A]: 14 } }), A, 1, 2);
    expect(view(s).cash[A]).toBe(START_CASH - amount);
    expect(view(s).cash[B]).toBe(START_CASH + amount);
  });

  test("sprzedaż przy długu: pole z budynkami za połowę, poziom znika", () => {
    // A ma 1 zł i pole 3 Maja z poziomem 2 (30 + 30 zł → sprzedaż za 30 zł); czynsz za Rynek u B to 5 zł.
    let s = with2(two(), { cash: { [A]: 1 }, owners: { 17: A, 31: B }, levels: { 17: 2 }, positions: { [A]: 26 } });
    s = roll(s, A, 2, 3);
    expect(view(s).phase).toBe("sell");
    s = play(s, A, { type: "sell", tile: 17 });
    expect(view(s).cash[A]).toBe(1 + 30 - 5);
    expect(view(s).levels[17] ?? 0).toBe(0);
    expect(view(s).owners[17]).toBeUndefined();
  });

  test("bankructwo czyści budynki", () => {
    const s = roll(
      with2(three(), { cash: { [A]: 0 }, owners: { 1: A, 17: B }, levels: { 1: 2, 17: 4 }, positions: { [A]: 14 } }),
      A,
      1,
      2,
    );
    expect(view(s).bankrupt).toEqual([A]);
    expect(view(s).levels[1] ?? 0).toBe(0);
  });

  test("majątek w rankingu liczy budynki", () => {
    let s = with2(two(), { round: ROUNDS, cash: { [A]: 100, [B]: 120 }, owners: { 17: A }, levels: { 17: 3 } });
    s = roll(s, A, 5, 6);
    s = roll(s, B, 5, 6);
    // A: 100 + 30 + 45 = 175 > B: 120.
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
  });

  test("limit czasu w fazie budowy pomija budowę", () => {
    expect(game.timeoutMove!(onOwn(), A, createRng(1))).toEqual({ type: "skip" });
  });
});

describe("Karty Dziekanatu", () => {
  /** Rzut na pole kart i odkrycie karty. */
  const reveal = (s: State) => play(s, A, { type: "card" });
  const draw = (s: State, title: string) => reveal(roll(top(s, title), A, 2, 3)); // A z 0 na pole kart 5

  test("talia: 18 kart, potasowana deterministycznie, kolejność ukryta w widoku", () => {
    expect(CARDS).toHaveLength(18);
    const s = two();
    expect([...s.deck].sort((x, y) => x - y)).toEqual(CARDS.map((_, i) => i));
    expect(game.setup([A, B], createRng(1)).deck).toEqual(s.deck);
    expect(game.setup([A, B], createRng(2)).deck).not.toEqual(s.deck);
    expect(view(s).deckSize).toBe(18);
    expect((view(s) as unknown as { deck?: unknown }).deck).toBeUndefined();
  });

  test("karta czeka na odkrycie: efekt dopiero po ruchu card, tylko gracza na turze", () => {
    const s = roll(top(two(), "Stypendium rektora"), A, 2, 3);
    expect(view(s).phase).toBe("card");
    expect(view(s).card).toBe(card("Stypendium rektora"));
    expect(view(s).cash[A]).toBe(START_CASH);
    expect(game.validateMove(s, B, { type: "card" })).toBe(false);
    expect(game.validateMove(s, A, { type: "roll" })).toBe(false);
    expect(game.validateMove(two(), A, { type: "card" })).toBe(false);
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual({ type: "card" });
    const after = reveal(s);
    expect(view(after).card).toBeNull();
    expect(view(after).cash[A]).toBe(START_CASH + 30);
  });

  test("dobrana karta jest zdarzeniem i wraca na spód talii", () => {
    const s = draw(two(), "Stypendium rektora");
    expect(view(s).events.at(-1)).toEqual({ type: "card", player: A, tile: 5, card: card("Stypendium rektora") });
    expect(s.deck.at(-1)).toBe(card("Stypendium rektora"));
    expect(s.deck).toHaveLength(18);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test.each([
    ["Stypendium rektora", 30],
    ["Stypendium socjalne", 20],
    ["Zwrot za akademik", 15],
    ["Nagroda w konkursie", 25],
    ["Warunek", -30],
    ["Kara w bibliotece", -10],
    ["Mandat", -20],
  ])("%s: %i zł", (title, amount) => {
    expect(view(draw(two(), title)).cash[A]).toBe(START_CASH + amount);
  });

  test("opłata z karty bez gotówki: sprzedaż pól, potem spłata do banku", () => {
    let s = draw(with2(two(), { cash: { [A]: 20 }, owners: { 17: A } }), "Warunek");
    expect(view(s).phase).toBe("sell");
    expect(view(s).debt).toEqual({ amount: 30, to: [] });
    s = play(s, A, { type: "sell", tile: 17 });
    expect(view(s).cash[A]).toBe(20 + 15 - 30);
    expect(view(s).cash[B]).toBe(START_CASH);
  });

  test("Korepetycje: każdy płaci 5 zł, a kto ma mniej, oddaje tyle, ile ma", () => {
    const s = draw(with2(three(), { cash: { [C]: 3 } }), "Korepetycje");
    expect(view(s).cash).toEqual({ [A]: START_CASH + 8, [B]: START_CASH - 5, [C]: 0 });
  });

  test("Składka na imprezę: płacisz każdemu po 5 zł", () => {
    const s = draw(three(), "Składka na imprezę");
    expect(view(s).cash).toEqual({ [A]: START_CASH - 10, [B]: START_CASH + 5, [C]: START_CASH + 5 });
  });

  test("Składka po sprzedaży pola: pieniądze trafiają do wszystkich wierzycieli", () => {
    let s = draw(with2(three(), { cash: { [A]: 6 }, owners: { 1: A } }), "Składka na imprezę");
    expect(view(s).debt).toEqual({ amount: 10, to: [B, C] });
    s = play(s, A, { type: "sell", tile: 1 });
    expect(view(s).cash).toEqual({ [A]: 1, [B]: START_CASH + 5, [C]: START_CASH + 5 });
  });

  test("Remont w akademiku: 5 zł za poziom, 20 zł za landmark", () => {
    const s = draw(with2(two(), { owners: { 1: A, 3: A, 17: A }, levels: { 1: 2, 17: 4 } }), "Remont w akademiku");
    expect(view(s).cash[A]).toBe(START_CASH - 30);
  });

  test("Spóźnienie na zajęcia: prosto na Kolokwium, bez kieszonkowego, nawet po dublecie koniec tury", () => {
    const s = reveal(roll(top(with2(two(), { positions: { [A]: 3 } }), "Spóźnienie na zajęcia"), A, 1, 1));
    expect(view(s).positions[A]).toBe(11);
    expect(view(s).kolokwium).toEqual([A]);
    expect(view(s).cash[A]).toBe(START_CASH);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("Zaliczenie w pierwszym terminie: karta zostaje u gracza, poza talią", () => {
    const s = draw(two(), "Zaliczenie w pierwszym terminie");
    expect(view(s).passes[A]).toBe(1);
    expect(s.deck).toHaveLength(17);
  });

  test("Zgubiona legitymacja: cofasz się o 3 i rozliczasz pole", () => {
    const s = draw(with2(two(), { owners: { 2: B } }), "Zgubiona legitymacja");
    expect(view(s).positions[A]).toBe(2);
    expect(view(s).cash[A]).toBe(START_CASH - 1);
  });

  test("Pobudka na 8:00: na Początek z kieszonkowym", () => {
    const s = draw(two(), "Pobudka na 8:00");
    expect(view(s).positions[A]).toBe(0);
    expect(view(s).laps[A]).toBe(1);
    expect(view(s).cash[A]).toBe(START_CASH + ALLOWANCE);
  });

  test("Wieczorne wyjście na Rynek: czynsz u właściciela, bez właściciela kupno", () => {
    expect(view(draw(with2(two(), { owners: { 31: B } }), "Wieczorne wyjście na Rynek")).cash[A]).toBe(START_CASH - 5);
    const free = draw(two(), "Wieczorne wyjście na Rynek");
    expect(view(free).positions[A]).toBe(31);
    expect(view(free).phase).toBe("buy");
  });

  test("Juwenalia!: przejście przez Początek daje kieszonkowe", () => {
    const s = reveal(roll(top(with2(two(), { positions: { [A]: 16 } }), "Juwenalia!"), A, 2, 3)); // 21 → 16
    expect(view(s).positions[A]).toBe(16);
    expect(view(s).cash[A]).toBe(START_CASH + ALLOWANCE);
  });

  test("Przerwa w kawiarni: Automat z kawą przez Początek", () => {
    const s = draw(two(), "Przerwa w kawiarni");
    expect(view(s).positions[A]).toBe(1);
    expect(view(s).cash[A]).toBe(START_CASH + ALLOWANCE);
    expect(view(s).phase).toBe("buy");
  });

  test("Nocny autobus MPK: najbliższe Ksero/Stołówka, u właściciela podwójny czynsz", () => {
    // Z 5 na Ksero (7): oczka 5 × 2 zł × 2.
    const s = draw(with2(two(), { owners: { 7: B } }), "Nocny autobus MPK");
    expect(view(s).positions[A]).toBe(7);
    expect(view(s).cash[A]).toBe(START_CASH - 20);
    // Z 13 najbliższa jest Stołówka (29).
    const far = reveal(roll(top(with2(two(), { positions: { [A]: 8 } }), "Nocny autobus MPK"), A, 2, 3));
    expect(view(far).positions[A]).toBe(29);
    expect(view(far).phase).toBe("buy");
  });
});

describe("Kolokwium", () => {
  const jailed = (patch: Parameters<typeof with2>[1] = {}) => with2(two(), { positions: { [A]: 11 }, kolokwium: [A], ...patch });

  test("zwykłe stanięcie na Kolokwium nic nie robi", () => {
    const s = roll(two(), A, 5, 6);
    expect(view(s).kolokwium).toEqual([]);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("dublet: zdajesz i od razu idziesz, bez dodatkowego rzutu", () => {
    let s = roll(jailed(), A, 2, 2);
    expect(view(s).kolokwium).toEqual([]);
    expect(view(s).positions[A]).toBe(15);
    expect(view(s).events).toContainEqual({ type: "pass", player: A });
    s = play(s, A, { type: "skip" }); // Zalew: pominięcie zakupu
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("bez dubletu: tura przerwy, w następnej gra normalnie", () => {
    let s = roll(jailed(), A, 1, 2);
    expect(view(s).positions[A]).toBe(11);
    expect(view(s).kolokwium).toEqual([]);
    expect(view(s).events.at(-1)).toEqual({ type: "fail", player: A });
    expect(game.waitingFor(s)).toEqual([B]);
    s = roll(s, B, 5, 6);
    s = roll(s, A, 1, 2);
    expect(view(s).positions[A]).toBe(14);
  });

  test("karta Zaliczenie wyprowadza automatycznie i wraca do talii", () => {
    const start = jailed({ passes: { [A]: 1 }, deck: two().deck.filter((c) => c !== card("Zaliczenie w pierwszym terminie")) });
    const s = roll(start, A, 1, 2);
    expect(view(s).positions[A]).toBe(14);
    expect(view(s).passes[A]).toBe(0);
    expect(view(s).events).toContainEqual({ type: "pass", player: A, card: card("Zaliczenie w pierwszym terminie") });
    expect(s.deck).toHaveLength(18);
  });

  test("limit czasu na Kolokwium: zwykły rzut", () => {
    expect(game.timeoutMove!(jailed(), A, createRng(1))).toEqual({ type: "roll" });
  });
});

describe("limit czasu", () => {
  test("rzut w fazie rzutu, pominięcie w fazie kupna", () => {
    expect(game.timeoutMove!(two(), A, createRng(1))).toEqual({ type: "roll" });
    const s = roll(two(), A, 1, 2);
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual({ type: "skip" });
  });

  test("w fazie sprzedaży sprzedaje najtańsze pole", () => {
    const s = roll(with2(two(), { cash: { [A]: 3 }, owners: { 29: A, 2: A, 3: B, 4: B, 6: B } }), A, 1, 3);
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual({ type: "sell", tile: 2 });
  });
});

describe("koniec gry", () => {
  test(`po ${ROUNDS} rundach koniec, ranking wg majątku (gotówka + ceny pól)`, () => {
    let s = with2(three(), {
      round: ROUNDS,
      cash: { [A]: 50, [B]: 30, [C]: 60 },
      owners: { 30: B },
    });
    s = roll(s, A, 5, 6); // każdy na Kolokwium w odwiedzinach, bez efektu
    s = roll(s, B, 5, 6);
    expect(game.isOver(s)).toBeNull();
    s = roll(s, C, 5, 6);
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, A] });
    expect(game.waitingFor(s)).toEqual([]);
    expect(view(s).turn).toBeNull();
    expect(game.validateMove(s, A, { type: "roll" })).toBe(false);
  });
});

describe("koniec gry: przypadki brzegowe", () => {
  test("limit rund z bankrutem na końcu kolejki: runda kończy się na ostatnim żywym, bankrut ostatni w rankingu", () => {
    let s: State = { ...with2(three(), { round: ROUNDS, cash: { [A]: 50, [B]: 60, [C]: 0 } }), bankrupt: [C] };
    s = roll(s, A, 5, 6);
    expect(game.isOver(s)).toBeNull();
    s = roll(s, B, 5, 6);
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, A, C] });
  });

  test("równy majątek na górze po limicie rund: remis bez zwycięzcy", () => {
    // B ma mniej gotówki, ale Rynek (50 zł) wyrównuje majątek; C jest niżej.
    let s = with2(three(), { round: ROUNDS, cash: { [A]: 100, [B]: 50, [C]: 60 }, owners: { 31: B } });
    for (const p of [A, B, C]) s = roll(s, p, 5, 6);
    expect(game.isOver(s)).toEqual({ ranking: [A, B, C] });
  });

  test("remis poniżej pierwszego miejsca nie odbiera wygranej", () => {
    let s = with2(three(), { round: ROUNDS, cash: { [A]: 60, [B]: 60, [C]: 100 } });
    for (const p of [A, B, C]) s = roll(s, p, 5, 6);
    expect(game.isOver(s)).toEqual({ winner: C, ranking: [C, A, B] });
  });

  test("dublet w ostatniej turze: najpierw dodatkowy rzut, potem koniec", () => {
    let s = with2(two(), { round: ROUNDS, positions: { [B]: 7 } });
    s = roll(s, A, 5, 6);
    s = roll(s, B, 2, 2); // Kolokwium w odwiedzinach
    expect(game.isOver(s)).toBeNull();
    expect(game.waitingFor(s)).toEqual([B]);
    s = roll(s, B, 1, 4); // Juwenalia bez własnych pól
    expect(game.isOver(s)).not.toBeNull();
    expect(view(s).round).toBe(ROUNDS);
  });

  test("monopolista wygrywa z bogatszym także przy 3 graczach, reszta wg majątku", () => {
    const owners = { 30: A, 31: A, 1: A, 2: A, 3: A, 4: A };
    let s = roll(with2(three(), { owners, positions: { [A]: 1 }, cash: { [B]: 300, [C]: 900 } }), A, 2, 3);
    s = play(s, A, { type: "buy" });
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, C, B] });
  });
});

describe("Juwenalia", () => {
  // A z 12 rzutem 1+3 staje na Juwenaliach (16).
  const party = (patch: Parameters<typeof with2>[1] = {}) => roll(with2(two(), { positions: { [A]: 12 }, ...patch }), A, 1, 3);

  test("wybór własnego pola: czynsz na nim ×2", () => {
    let s = party({ owners: { 17: A } });
    expect(view(s).phase).toBe("juwenalia");
    expect(game.waitingFor(s)).toEqual([A]);
    expect(game.validateMove(s, B, { type: "juwenalia", tile: 17 })).toBe(false);
    s = play(s, A, { type: "juwenalia", tile: 17 });
    expect(view(s).juwenalia).toEqual({ tile: 17, factor: 2 });
    expect(view(s).events.at(-1)).toEqual({ type: "juwenalia", player: A, tile: 17, amount: 2 });
    expect(game.waitingFor(s)).toEqual([B]);
    // B z 14 na 17: czynsz 3 zł × 2.
    s = roll(with2(s, { positions: { [B]: 14 } }), B, 1, 2);
    expect(view(s).cash[B]).toBe(START_CASH - 6);
    expect(view(s).cash[A]).toBe(START_CASH + 6);
  });

  test("kolejne Juwenalia: ×3 i przeniesienie na nowe pole", () => {
    let s = party({ owners: { 17: A, 31: A }, juwenalia: { tile: 17, factor: 2 }, festivals: 1 });
    s = play(s, A, { type: "juwenalia", tile: 31 });
    expect(view(s).juwenalia).toEqual({ tile: 31, factor: 3 });
    // Stare pole wraca do zwykłego czynszu.
    s = roll(with2(s, { positions: { [B]: 14 } }), B, 1, 2);
    expect(view(s).cash[B]).toBe(START_CASH - 3);
  });

  test("tylko własne pole", () => {
    const s = party({ owners: { 17: A, 18: B } });
    expect(game.validateMove(s, A, { type: "juwenalia", tile: 18 })).toBe(false);
    expect(game.validateMove(s, A, { type: "juwenalia", tile: 19 })).toBe(false);
    expect(game.validateMove(s, A, { type: "juwenalia", tile: 16 })).toBe(false);
    expect(game.validateMove(two(), A, { type: "juwenalia", tile: 17 })).toBe(false);
  });

  test("bez własnych pól Juwenalia nic nie robią", () => {
    const s = party();
    expect(view(s).juwenalia).toBeNull();
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("sprzedaż pola z Juwenaliami je kasuje", () => {
    // A ma 1 zł, czynsz za Rynek u B 5 zł; A sprzedaje 17 z Juwenaliami.
    let s = with2(two(), { cash: { [A]: 1 }, owners: { 17: A, 31: B }, positions: { [A]: 26 }, juwenalia: { tile: 17, factor: 2 } });
    s = roll(s, A, 2, 3);
    s = play(s, A, { type: "sell", tile: 17 });
    expect(view(s).juwenalia).toBeNull();
  });

  test("limit czasu: Juwenalia na najdroższym własnym polu", () => {
    expect(game.timeoutMove!(party({ owners: { 1: A, 31: A, 17: A } }), A, createRng(1))).toEqual({ type: "juwenalia", tile: 31 });
  });
});

describe("Bilet MPK", () => {
  // A z 24 rzutem 1+2 staje na MPK (27).
  const ticket = (a = 1, b = 2) => roll(with2(two(), { positions: { [A]: 24 } }), A, a, b);

  test("stanięcie na MPK daje bilet i kończy turę, także po dublecie", () => {
    const s = roll(with2(two(), { positions: { [A]: 25 } }), A, 1, 1);
    expect(view(s).positions[A]).toBe(27);
    expect(view(s).mpk).toEqual([A]);
    expect(view(s).events.at(-1)).toEqual({ type: "mpk", player: A });
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("następna tura: jazda na dowolne pole bez kieszonkowego za Początek, z rozliczeniem pola", () => {
    let s = roll(ticket(), B, 5, 6);
    s = with2(s, { owners: { 3: B } });
    s = play(s, A, { type: "travel", tile: 3 }, dice(1, 2));
    expect(view(s).positions[A]).toBe(3);
    expect(view(s).mpk).toEqual([]);
    expect(view(s).events).toContainEqual({ type: "travel", player: A, tile: 3 });
    // Bez kieszonkowego, -2 czynszu za Bibliotekę.
    expect(view(s).cash[A]).toBe(START_CASH - 2);
    expect(view(s).events.some((e) => e.type === "allowance")).toBe(false);
  });

  test("jazda na Ksero: czynsz z nowego rzutu, nie ze starych oczek", () => {
    let s = roll(ticket(), B, 5, 6); // ostatnie oczka: 5 + 6 (rzut B)
    s = with2(s, { owners: { 7: B } });
    s = play(s, A, { type: "travel", tile: 7 }, dice(1, 2));
    expect(view(s).dice).toEqual([1, 2]);
    expect(view(s).cash[A]).toBe(START_CASH - 6); // 3 oczka × 2 zł
  });

  test("zwykły rzut zamiast jazdy zużywa bilet", () => {
    let s = roll(ticket(), B, 5, 6);
    s = roll(s, A, 5, 6);
    expect(view(s).mpk).toEqual([]);
  });

  test("jazda tylko z biletem, w fazie rzutu i nie na to samo pole", () => {
    expect(game.validateMove(two(), A, { type: "travel", tile: 3 })).toBe(false);
    const s = roll(ticket(), B, 5, 6);
    expect(game.validateMove(s, A, { type: "travel", tile: 27 })).toBe(false);
    expect(game.validateMove(s, B, { type: "travel", tile: 3 })).toBe(false);
    expect(game.validateMove(s, A, { type: "travel", tile: 3 })).toBe(true);
  });
});

describe("wykupienie", () => {
  // A z 0 rzutem 1+3 staje na Hali PRz (4, cena 15 zł) należącej do B.
  const onTheirs = (patch: Parameters<typeof with2>[1] = {}) => roll(with2(two(), { owners: { 4: B }, ...patch }), A, 1, 3);

  test("po czynszu można wykupić pole za 2× wartość, pieniądze dostaje właściciel", () => {
    // A ma resztę grupy (3, 6), więc wykup zamyka komplet. Wartość 15 + 8, czynsz 6 zł.
    let s = onTheirs({ owners: { 3: A, 4: B, 6: A }, levels: { 4: 1 } });
    expect(view(s).phase).toBe("buyout");
    expect(game.waitingFor(s)).toEqual([A]);
    expect(game.validateMove(s, B, { type: "buyout" })).toBe(false);
    s = play(s, A, { type: "buyout" });
    expect(view(s).owners[4]).toBe(A);
    expect(view(s).levels[4]).toBe(1);
    expect(view(s).cash[A]).toBe(START_CASH - 6 - 46);
    expect(view(s).cash[B]).toBe(START_CASH + 6 + 46);
    expect(view(s).events).toContainEqual({ type: "buyout", player: A, tile: 4, amount: 46, to: B });
    // Po wykupie można budować jak na własnym polu (tu z kompletem, więc wyżej niż poziom 1).
    expect(view(s).phase).toBe("build");
  });

  test("pominięcie wykupu kończy turę", () => {
    const s = play(onTheirs(), A, { type: "skip" });
    expect(view(s).owners[4]).toBe(B);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("landmarku nie da się wykupić", () => {
    const s = onTheirs({ owners: { 3: B, 4: B, 6: B }, levels: { 4: 4 } });
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("bez pieniędzy na wykup nie ma oferty", () => {
    const s = onTheirs({ cash: { [A]: 31 } }); // po czynszu 29 zł < 30 zł
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("wykup ostatniego pola grupy daje komplet", () => {
    let s = onTheirs({ owners: { 3: A, 4: B, 6: A } });
    s = play(s, A, { type: "buyout" });
    expect(view(s).events.at(-1)).toEqual({ type: "set", player: A, tile: 4 });
  });

  test("limit czasu pomija wykup", () => {
    expect(game.timeoutMove!(onTheirs(), A, createRng(1))).toEqual({ type: "skip" });
  });
});

describe("monopol", () => {
  // A ma już grupy Noc w centrum (30, 31) i Rano (1, 2) oraz dwa pola z trzeciej (3, 4); dokupuje Rektorat (6).
  const owners = { 30: A, 31: A, 1: A, 2: A, 3: A, 4: A };

  test("trzecia pełna grupa kończy grę wygraną", () => {
    let s = roll(with2(two(), { owners, positions: { [A]: 1 } }), A, 2, 3);
    s = play(s, A, { type: "buy" });
    expect(view(s).monopoly).toBe(A);
    expect(view(s).events.at(-1)).toEqual({ type: "monopoly", player: A });
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
    expect(game.waitingFor(s)).toEqual([]);
  });

  test("wygrana także przez wykup, nawet gdy przeciwnik jest bogatszy", () => {
    let s = roll(with2(two(), { owners: { ...owners, 6: B }, positions: { [A]: 1 }, cash: { [B]: 1000 } }), A, 2, 3);
    s = play(s, A, { type: "buyout" });
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
  });

  test("Ksero i Stołówka się nie liczą", () => {
    let s = roll(with2(two(), { owners: { 30: A, 31: A, 1: A, 2: A, 29: A } }), A, 3, 4);
    s = play(s, A, { type: "buy" });
    expect(game.isOver(s)).toBeNull();
  });
});

describe("wybór postaci", () => {
  const fresh = () => game.setup([A, B, C], createRng(1));
  const pick = (s: State, player: string, character: number) => play(s, player, { type: "pick", character });

  test("każdy wybiera naraz, kolejność wyboru dowolna; czekamy tylko na tych bez postaci", () => {
    let s = pick(fresh(), C, 2);
    expect(game.waitingFor(s)).toEqual([A, B]);
    s = pick(s, A, 5);
    expect(game.waitingFor(s)).toEqual([B]);
    expect(view(s).characters).toEqual({ [C]: 2, [A]: 5 });
    expect(view(s).phase).toBe("pick");
  });

  test("po ostatnim wyborze gra rusza: rzuca pierwszy gracz", () => {
    let s = pick(pick(fresh(), A, 0), B, 1);
    s = pick(s, C, 3);
    expect(view(s).phase).toBe("roll");
    expect(game.waitingFor(s)).toEqual([A]);
    expect(view(s).characters).toEqual({ [A]: 0, [B]: 1, [C]: 3 });
  });

  test("nie można wziąć zajętej postaci, wybrać drugi raz ani spoza listy", () => {
    const s = pick(fresh(), A, 0);
    expect(game.validateMove(s, B, { type: "pick", character: 0 })).toBe(false);
    expect(game.validateMove(s, A, { type: "pick", character: 1 })).toBe(false);
    expect(game.validateMove(s, B, { type: "pick", character: CHARACTERS.length })).toBe(false);
    expect(game.validateMove(s, "obcy", { type: "pick", character: 1 })).toBe(false);
  });

  test("w trakcie wyboru nie można rzucać, a po starcie nie można zmienić postaci", () => {
    expect(game.validateMove(fresh(), A, { type: "roll" })).toBe(false);
    expect(game.validateMove(two(), A, { type: "pick", character: 4 })).toBe(false);
  });

  test("po limicie czasu gracz dostaje losową wolną postać", () => {
    const s = pick(pick(fresh(), A, 0), B, 1);
    for (const seed of [1, 2, 3, 4, 5]) {
      const move = game.timeoutMove!(s, C, createRng(seed));
      expect(move.type).toBe("pick");
      expect(game.validateMove(s, C, move)).toBe(true);
    }
  });
});

describe("statystyki do podsumowania partii", () => {
  test("po setupie: majątek startowy jako pierwszy punkt wykresu, liczniki na zero", () => {
    const s = game.setup([A, B], createRng(1));
    expect(view(s).stats).toEqual({
      wealth: { [A]: [START_CASH], [B]: [START_CASH + SEAT_BONUS] },
      rentPaid: { [A]: 0, [B]: 0 },
      tileIncome: {},
      doubles: { [A]: 0, [B]: 0 },
    });
  });

  test("czynsz: płacący ma go w rentPaid, pole w tileIncome", () => {
    let s = roll(with2(two(), { owners: { 4: B } }), A, 1, 3);
    expect(view(s).stats.rentPaid[A]).toBe(2);
    expect(view(s).stats.tileIncome[4]).toBe(2);
    s = play(s, A, { type: "skip" });
    s = roll(s, B, 5, 6);
    s = roll(s, A, 1, 1); // z 4 na 6: Rektorat jest wolny, czynsz tylko z poprzedniego razu
    expect(view(s).stats.rentPaid).toEqual({ [A]: 2, [B]: 0 });
  });

  test("dublety liczone na gracza", () => {
    let s = roll(two(), A, 1, 1);
    s = play(s, A, { type: "skip" });
    s = roll(s, A, 2, 3);
    expect(view(s).stats.doubles).toEqual({ [A]: 1, [B]: 0 });
  });

  test("koniec rundy dopisuje majątek każdego gracza (gotówka + pola + budynki)", () => {
    let s = with2(two(), { owners: { 3: A }, levels: { 3: 1 } });
    s = roll(s, A, 5, 6);
    s = roll(s, B, 5, 6);
    expect(view(s).round).toBe(2);
    const wealthA = view(s).cash[A] + price(3) + buildCost(3, 0, 1);
    expect(view(s).stats.wealth[A].at(-1)).toBe(wealthA);
    expect(view(s).stats.wealth[B].at(-1)).toBe(view(s).cash[B]);
    expect(view(s).stats.wealth[A]).toHaveLength(2);
  });
});
