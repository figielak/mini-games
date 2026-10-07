import { z } from "zod";
import type { GameDefinition, PlayerId, Rng } from "./core.ts";

export const SIZE = 32;
export const ROUNDS = 20;
export const START_CASH = 200;
/** Kieszonkowe za przejście przez Początek. */
export const ALLOWANCE = 20;
const TAX = 15;

/** Grupy (pory dnia studenta): cena i pola [indeks, nazwa]. Skrajne grupy po 2 pola, jak w Monopoly. */
const GROUP_DEFS: [price: number, tiles: [number, string][]][] = [
  [10, [[1, "Automat z kawą"], [2, "Automat z przekąskami"]]],
  [15, [[3, "Biblioteka PRz"], [4, "Hala sportowa PRz"], [6, "Rektorat"]]],
  [20, [[8, "Wydział Mechaniczny"], [9, "Wydział Elektryczny"], [10, "Wydział Chemiczny"]]],
  [25, [[12, "Hala Podpromie"], [14, "Stadion Stali"], [15, "Zalew Rzeszowski"]]],
  [30, [[17, "Ulica 3 Maja"], [18, "Galeria Rzeszów"], [19, "Millenium Hall"]]],
  [35, [[20, "Kino"], [22, "Kręgielnia"], [23, "Klub studencki"]]],
  [40, [[24, "Bulwary nad Wisłokiem"], [25, "Okrągła kładka"], [26, "Pomnik Czynu Rewolucyjnego"]]],
  [50, [[30, "Zamek Lubomirskich"], [31, "Rynek"]]],
];
export const GROUPS = GROUP_DEFS.map(([, tiles]) => tiles.map(([i]) => i));

/** Ksero i Stołówka działają jak wodociągi: czynsz zależy od rzutu. */
const UTILITIES = [7, 29];
const UTILITY_PRICE = 30;
/** Mnożnik sumy oczek przy 1 i 2 posiadanych. */
export const UTILITY_RATES = [2, 5];

/** Czynsz z budynkami: ułamek ceny P dla poziomów 1-4 (bez mnożnika za komplet). */
export const LEVEL_RENT = [0.5, 1.5, 3, 5];
export const LANDMARK = LEVEL_RENT.length;

export type Tile =
  | { kind: "start" | "kolokwium" | "juwenalia" | "mpk" | "karty"; name: string }
  | { kind: "property"; name: string; group: number; price: number }
  | { kind: "utility"; name: string; price: number }
  | { kind: "tax"; name: string; amount: number };
export type TileKind = Tile["kind"];

const SPECIAL: Record<number, Tile> = {
  0: { kind: "start", name: "Początek" },
  5: { kind: "karty", name: "Karty Dziekanatu" },
  7: { kind: "utility", name: "Ksero", price: UTILITY_PRICE },
  11: { kind: "kolokwium", name: "Kolokwium" },
  13: { kind: "karty", name: "Karty Dziekanatu" },
  16: { kind: "juwenalia", name: "Juwenalia" },
  21: { kind: "karty", name: "Karty Dziekanatu" },
  27: { kind: "mpk", name: "Bilet MPK" },
  28: { kind: "tax", name: "Opłata za akademik", amount: TAX },
  29: { kind: "utility", name: "Stołówka", price: UTILITY_PRICE },
};

const PROPERTIES: Record<number, Tile> = Object.fromEntries(
  GROUP_DEFS.flatMap(([price, tiles], group) => tiles.map(([i, name]) => [i, { kind: "property", name, group, price }])),
);

/** Pola zgodnie z ruchem wskazówek zegara od lewego górnego rogu planszy 12×6. */
export const BOARD: Tile[] = Array.from({ length: SIZE }, (_, i) => SPECIAL[i] ?? PROPERTIES[i]);

/** Pole Kolokwium (róg „więzienia”). */
export const KOLOKWIUM = 11;

/** Efekt Karty Dziekanatu. */
export type CardEffect =
  | { kind: "cash"; amount: number }
  | { kind: "fromEach"; amount: number }
  | { kind: "toEach"; amount: number }
  | { kind: "repairs"; perLevel: number; perLandmark: number }
  | { kind: "kolokwium" }
  | { kind: "pass" }
  | { kind: "back"; steps: number }
  | { kind: "goto"; tile: number }
  | { kind: "nearestUtility" };

/** Talia Kart Dziekanatu (numer karty = indeks); tytuł i opis pokazuje UI. */
export const CARDS: { title: string; text: string; effect: CardEffect }[] = [
  { title: "Stypendium rektora", text: "Za średnią 5,0. Dostajesz 30 zł.", effect: { kind: "cash", amount: 30 } },
  { title: "Stypendium socjalne", text: "Wniosek przeszedł. Dostajesz 20 zł.", effect: { kind: "cash", amount: 20 } },
  { title: "Zwrot za akademik", text: "Nadpłata za pokój wraca. Dostajesz 15 zł.", effect: { kind: "cash", amount: 15 } },
  { title: "Nagroda w konkursie", text: "Projekt koła naukowego wygrywa. Dostajesz 25 zł.", effect: { kind: "cash", amount: 25 } },
  { title: "Korepetycje", text: "Uczysz innych do kolokwium. Każdy płaci ci 5 zł.", effect: { kind: "fromEach", amount: 5 } },
  { title: "Warunek", text: "Nie poszło. Płacisz 30 zł za warunek.", effect: { kind: "cash", amount: -30 } },
  { title: "Kara w bibliotece", text: "Przetrzymana książka. Płacisz 10 zł.", effect: { kind: "cash", amount: -10 } },
  { title: "Mandat", text: "Jazda MPK bez biletu. Płacisz 20 zł.", effect: { kind: "cash", amount: -20 } },
  { title: "Składka na imprezę", text: "Zrzutka na domówkę. Płacisz każdemu po 5 zł.", effect: { kind: "toEach", amount: 5 } },
  {
    title: "Remont w akademiku",
    text: "Płacisz 5 zł za każdy poziom budynków i 20 zł za każdy landmark.",
    effect: { kind: "repairs", perLevel: 5, perLandmark: 20 },
  },
  { title: "Spóźnienie na zajęcia", text: "Idziesz prosto na Kolokwium, bez kieszonkowego.", effect: { kind: "kolokwium" } },
  {
    title: "Zaliczenie w pierwszym terminie",
    text: "Zachowaj kartę: wychodzisz z Kolokwium bez rzutu na dublet.",
    effect: { kind: "pass" },
  },
  { title: "Zgubiona legitymacja", text: "Wracasz po nią: cofasz się o 3 pola.", effect: { kind: "back", steps: 3 } },
  { title: "Pobudka na 8:00", text: `Idziesz na Początek i dostajesz ${ALLOWANCE} zł kieszonkowego.`, effect: { kind: "goto", tile: 0 } },
  { title: "Wieczorne wyjście na Rynek", text: "Idziesz na Rynek.", effect: { kind: "goto", tile: 31 } },
  { title: "Juwenalia!", text: "Idziesz na Juwenalia. Mijając Początek, dostajesz kieszonkowe.", effect: { kind: "goto", tile: 16 } },
  {
    title: "Nocny autobus MPK",
    text: "Jedziesz na najbliższe Ksero albo Stołówkę. Właścicielowi płacisz podwójny czynsz.",
    effect: { kind: "nearestUtility" },
  },
  { title: "Przerwa w kawiarni", text: "Idziesz na Automat z kawą. Mijając Początek, dostajesz kieszonkowe.", effect: { kind: "goto", tile: 1 } },
];
const PASS_CARD = CARDS.findIndex((c) => c.effect.kind === "pass");

export type Move = { type: "roll" } | { type: "buy" } | { type: "skip" } | { type: "sell"; tile: number } | { type: "build"; level: number };

/** Co się wydarzyło w ostatnim ruchu; UI zamienia to na tekst. */
export type Event = {
  type: "allowance" | "buy" | "set" | "skip" | "build" | "rent" | "tax" | "sell" | "bankrupt" | "card" | "kolokwium" | "pass" | "fail";
  player: PlayerId;
  amount?: number;
  tile?: number;
  /** Poziom po budowie (4 = landmark). */
  level?: number;
  /** Numer Karty Dziekanatu (wylosowanej albo użytej). */
  card?: number;
  to?: PlayerId | null;
};

export interface State {
  players: PlayerId[];
  positions: Record<PlayerId, number>;
  /** Pełne okrążenia (przejścia przez Początek). */
  laps: Record<PlayerId, number>;
  cash: Record<PlayerId, number>;
  owners: Record<number, PlayerId>;
  /** Poziom zabudowy pola: 1-3 budynki, 4 landmark; brak wpisu = 0. */
  levels: Record<number, number>;
  /** Kolejność odpadania. */
  bankrupt: PlayerId[];
  turn: number;
  phase: "roll" | "buy" | "build" | "sell" | "over";
  dice: [number, number] | null;
  /** Dublety z rzędu w tej turze. */
  doubles: number;
  round: number;
  /** Niespłacony czynsz lub opłata (faza sprzedaży); kwota dzieli się po równo między wierzycieli, pusta lista = bank. */
  debt: { amount: number; to: PlayerId[] } | null;
  /** Talia Kart Dziekanatu: dobiera się z początku, karta wraca na koniec. */
  deck: number[];
  /** Kto siedzi na Kolokwium. */
  kolokwium: PlayerId[];
  /** Zachowane karty „Zaliczenie w pierwszym terminie”. */
  passes: Record<PlayerId, number>;
  /** Ostatnie zdarzenia (najwyżej LOG), żeby gracz, który odwrócił wzrok, wiedział, co się stało. */
  events: Event[];
}

/** Widok bez kolejności talii (to byłaby wiedza o przyszłych kartach). */
export type View = Omit<State, "turn" | "doubles" | "deck"> & { turn: PlayerId | null; deckSize: number };

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll") }),
  z.object({ type: z.literal("buy") }),
  z.object({ type: z.literal("skip") }),
  z.object({ type: z.literal("sell"), tile: z.number().int().min(0).max(SIZE - 1) }),
  z.object({ type: z.literal("build"), level: z.number().int().min(1).max(LANDMARK) }),
]);

const LOG = 4;
const current = (s: State) => s.players[s.turn];
const log = (s: State, e: Event): State => ({ ...s, events: [...s.events, e].slice(-LOG) });
const priceOf = (tile: number) => {
  const t = BOARD[tile];
  return t.kind === "property" || t.kind === "utility" ? t.price : 0;
};
/** Komplet, do którego należy pole: grupa albo para Ksero i Stołówka. */
export function setOf(tile: number): number[] {
  const t = BOARD[tile];
  return t.kind === "utility" ? UTILITIES : t.kind === "property" ? GROUPS[t.group] : [];
}
const levelOf = (s: State, tile: number) => s.levels[tile] ?? 0;

/** Koszt budowy z poziomu from na to: poziomy 1-3 po P/2, landmark P. */
export function buildCost(tile: number, from: number, to: number): number {
  const p = priceOf(tile);
  let cost = 0;
  for (let l = from + 1; l <= to; l++) cost += l === LANDMARK ? p : Math.round(p / 2);
  return cost;
}

/** Najwyższy możliwy poziom: landmark tylko z kompletem grupy; Ksero, Stołówka i reszta bez budowy. */
export function maxLevel(owners: Record<number, PlayerId>, tile: number): number {
  if (BOARD[tile].kind !== "property") return 0;
  return setOf(tile).every((i) => owners[i] === owners[tile]) ? LANDMARK : LANDMARK - 1;
}

/** Wartość pola z budynkami: cena + koszt budowy. */
const valueOf = (s: State, tile: number) => priceOf(tile) + buildCost(tile, 0, levelOf(s, tile));
/** Sprzedaż bankowi za połowę wartości pola z budynkami. */
const saleValue = (s: State, tile: number) => Math.floor(valueOf(s, tile) / 2);
const owned = (s: State, p: PlayerId) => Object.keys(s.owners).map(Number).filter((i) => s.owners[i] === p);
const wealth = (s: State, p: PlayerId) => s.cash[p] + owned(s, p).reduce((sum, i) => sum + valueOf(s, i), 0);

/** Czynsz bez budynków: P/10 w pełnych złotych. */
export const baseRent = (price: number) => Math.round(price / 10);

/** Czynsz P/10, cała grupa podwaja go; z budynkami LEVEL_RENT × P; Ksero i Stołówka: suma oczek × stawka zależna od liczby posiadanych. */
function rent(s: State, tile: number): number {
  const t = BOARD[tile];
  const owner = s.owners[tile];
  if (t.kind === "utility") {
    const count = UTILITIES.filter((i) => s.owners[i] === owner).length;
    return (s.dice![0] + s.dice![1]) * UTILITY_RATES[count - 1];
  }
  if (t.kind !== "property") return 0;
  const level = levelOf(s, tile);
  if (level > 0) return Math.round(LEVEL_RENT[level - 1] * t.price);
  const base = baseRent(t.price);
  return GROUPS[t.group].every((i) => s.owners[i] === owner) ? base * 2 : base;
}

/** Tura przechodzi na następnego gracza, który nie zbankrutował. */
function endTurn(s: State): State {
  let turn = s.turn;
  do turn = (turn + 1) % s.players.length;
  while (s.bankrupt.includes(s.players[turn]));
  const round = turn <= s.turn ? s.round + 1 : s.round;
  return { ...s, turn, round, doubles: 0, phase: round > ROUNDS ? "over" : "roll" };
}

/** Koniec rozstrzygania pola: dublet daje kolejny rzut, chyba że to trzeci z rzędu. */
const finish = (s: State): State => (s.doubles > 0 && s.doubles < 3 ? { ...s, phase: "roll" } : endTurn(s));

const alive = (s: State) => s.players.filter((p) => !s.bankrupt.includes(p));

function goBankrupt(s: State, player: PlayerId, to: PlayerId[]): State {
  const cash = { ...s.cash, [player]: 0 };
  // ponytail: reszta z dzielenia przepada w banku
  for (const q of to) cash[q] += Math.floor(s.cash[player] / to.length);
  const owners = Object.fromEntries(Object.entries(s.owners).filter(([, p]) => p !== player));
  const levels = Object.fromEntries(Object.entries(s.levels).filter(([tile]) => owners[Number(tile)]));
  const next: State = {
    ...s,
    cash,
    owners,
    levels,
    debt: null,
    bankrupt: [...s.bankrupt, player],
    kolokwium: s.kolokwium.filter((p) => p !== player),
    events: [...s.events, { type: "bankrupt" as const, player }].slice(-LOG),
  };
  return next.players.length - next.bankrupt.length <= 1 ? { ...next, phase: "over" } : endTurn(next);
}

/** Płatność (po równo dla wierzycieli, pusta lista = bank) ze sprzedażą pól albo bankructwem, gdy gotówki brakuje. */
function pay(s: State, player: PlayerId, amount: number, to: PlayerId[]): State {
  if (s.cash[player] >= amount) {
    const cash = { ...s.cash, [player]: s.cash[player] - amount };
    for (const q of to) cash[q] += amount / to.length;
    return finish({ ...s, cash, debt: null });
  }
  const assets = owned(s, player).reduce((sum, i) => sum + saleValue(s, i), 0);
  if (s.cash[player] + assets >= amount) return { ...s, phase: "sell", debt: { amount, to } };
  return goBankrupt(s, player, to);
}

/** Na swoim polu (także zaraz po kupnie) faza budowy, jeśli jest co budować i gracza stać na kolejny poziom. */
function offerBuild(s: State, player: PlayerId): State {
  const tile = s.positions[player];
  const level = levelOf(s, tile);
  const canBuild = level < maxLevel(s.owners, tile) && s.cash[player] >= buildCost(tile, level, level + 1);
  return canBuild ? { ...s, phase: "build" } : finish(s);
}

/** Ruch do przodu o steps pól; przejście przez Początek daje kieszonkowe. */
function advance(s: State, player: PlayerId, steps: number): State {
  const to = s.positions[player] + steps;
  const passed = Math.floor(to / SIZE);
  const moved = {
    ...s,
    positions: { ...s.positions, [player]: to % SIZE },
    laps: { ...s.laps, [player]: s.laps[player] + passed },
    cash: { ...s.cash, [player]: s.cash[player] + passed * ALLOWANCE },
  };
  return passed ? log(moved, { type: "allowance", player, amount: passed * ALLOWANCE }) : moved;
}
const moveTo = (s: State, player: PlayerId, tile: number) => advance(s, player, (tile - s.positions[player] + SIZE) % SIZE || SIZE);

/** Na Kolokwium: pionek na pole 11 bez kieszonkowego, tura się kończy. */
function toKolokwium(s: State, player: PlayerId): State {
  return endTurn(
    log({ ...s, positions: { ...s.positions, [player]: KOLOKWIUM }, kolokwium: [...s.kolokwium, player] }, { type: "kolokwium", player }),
  );
}

/** Karta Dziekanatu: dobranie z wierzchu, powrót na spód (Zaliczenie zostaje u gracza), efekt. */
function drawCard(s: State, player: PlayerId): State {
  const [id, ...rest] = s.deck;
  const effect = CARDS[id].effect;
  const next = log({ ...s, deck: effect.kind === "pass" ? rest : [...rest, id] }, { type: "card", player, tile: s.positions[player], card: id });
  const others = alive(next).filter((q) => q !== player);
  switch (effect.kind) {
    case "cash":
      return effect.amount >= 0
        ? finish({ ...next, cash: { ...next.cash, [player]: next.cash[player] + effect.amount } })
        : pay(next, player, -effect.amount, []);
    case "fromEach": {
      // Korepetycje nie wpędzają innych w długi: każdy oddaje tyle, ile ma.
      const cash = { ...next.cash };
      for (const q of others) {
        const paid = Math.min(effect.amount, cash[q]);
        cash[q] -= paid;
        cash[player] += paid;
      }
      return finish({ ...next, cash });
    }
    case "toEach":
      return pay(next, player, effect.amount * others.length, others);
    case "repairs": {
      const amount = owned(next, player).reduce((sum, i) => {
        const level = levelOf(next, i);
        return sum + (level === LANDMARK ? effect.perLandmark : level * effect.perLevel);
      }, 0);
      return amount ? pay(next, player, amount, []) : finish(next);
    }
    case "kolokwium":
      return toKolokwium(next, player);
    case "pass":
      return finish({ ...next, passes: { ...next.passes, [player]: (next.passes[player] ?? 0) + 1 } });
    case "back":
      return land({ ...next, positions: { ...next.positions, [player]: (next.positions[player] - effect.steps + SIZE) % SIZE } }, player);
    case "goto":
      return land(moveTo(next, player, effect.tile), player);
    case "nearestUtility": {
      const pos = next.positions[player];
      return land(moveTo(next, player, UTILITIES.find((u) => u > pos) ?? UTILITIES[0]), player, 2);
    }
  }
}

/** Rozliczenie pola, na którym stanął gracz; rentFactor mnoży czynsz (Nocny autobus). */
function land(s: State, player: PlayerId, rentFactor = 1): State {
  const pos = s.positions[player];
  const tile = BOARD[pos];
  if (tile.kind === "tax") return pay(log(s, { type: "tax", player, amount: tile.amount }), player, tile.amount, []);
  if (tile.kind === "karty") return drawCard(s, player);
  if (tile.kind !== "property" && tile.kind !== "utility") return finish(s);

  const owner = s.owners[pos];
  if (!owner) return s.cash[player] >= tile.price ? { ...s, phase: "buy" } : finish(s);
  if (owner === player) return offerBuild(s, player);
  const amount = rent(s, pos) * rentFactor;
  return pay(log(s, { type: "rent", player, amount, tile: pos, to: owner }), player, amount, [owner]);
}

export const kampusTour: GameDefinition<State, Move> = {
  id: "kampus-tour",
  name: "Kampus Tour",
  minPlayers: 2,
  maxPlayers: 4,
  turnSeconds: 60,
  moveSchema,

  setup(players, rng) {
    const deck = CARDS.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return {
      players,
      positions: Object.fromEntries(players.map((p) => [p, 0])),
      laps: Object.fromEntries(players.map((p) => [p, 0])),
      cash: Object.fromEntries(players.map((p) => [p, START_CASH])),
      owners: {},
      levels: {},
      bankrupt: [],
      turn: 0,
      phase: "roll",
      dice: null,
      doubles: 0,
      round: 1,
      debt: null,
      events: [],
      deck,
      kolokwium: [],
      passes: {},
    };
  },

  validateMove(s, player, move) {
    if (s.phase === "over" || current(s) !== player) return false;
    if (move.type === "roll") return s.phase === "roll";
    if (move.type === "sell") return s.phase === "sell" && s.owners[move.tile] === player;
    if (move.type === "build") {
      const tile = s.positions[player];
      const level = levelOf(s, tile);
      return (
        s.phase === "build" &&
        move.level > level &&
        move.level <= maxLevel(s.owners, tile) &&
        buildCost(tile, level, move.level) <= s.cash[player]
      );
    }
    if (move.type === "skip") return s.phase === "buy" || s.phase === "build";
    return s.phase === "buy";
  },

  applyMove(s, player, move, rng: Rng) {
    // Pominięcie zakupu jest zdarzeniem, pominięcie budowy nie.
    if (move.type === "skip") return finish(s.phase === "buy" ? log(s, { type: "skip", player, tile: s.positions[player] }) : s);

    if (move.type === "build") {
      const tile = s.positions[player];
      const amount = buildCost(tile, levelOf(s, tile), move.level);
      return finish(
        log(
          { ...s, levels: { ...s.levels, [tile]: move.level }, cash: { ...s.cash, [player]: s.cash[player] - amount } },
          { type: "build", player, tile, level: move.level, amount },
        ),
      );
    }

    if (move.type === "buy") {
      const tile = s.positions[player];
      const amount = priceOf(tile);
      const bought = log(
        { ...s, owners: { ...s.owners, [tile]: player }, cash: { ...s.cash, [player]: s.cash[player] - amount } },
        { type: "buy", player, amount, tile },
      );
      return offerBuild(setOf(tile).every((i) => bought.owners[i] === player) ? log(bought, { type: "set", player, tile }) : bought, player);
    }

    if (move.type === "sell") {
      const owners = { ...s.owners };
      delete owners[move.tile];
      const levels = { ...s.levels };
      delete levels[move.tile];
      const amount = saleValue(s, move.tile);
      const next: State = {
        ...s,
        owners,
        levels,
        cash: { ...s.cash, [player]: s.cash[player] + amount },
        events: [...s.events, { type: "sell" as const, player, amount, tile: move.tile }].slice(-LOG),
      };
      const debt = s.debt!;
      return next.cash[player] >= debt.amount ? pay(next, player, debt.amount, debt.to) : next;
    }

    const dice: [number, number] = [Math.floor(rng() * 6) + 1, Math.floor(rng() * 6) + 1];
    const double = dice[0] === dice[1];
    let next: State = { ...s, dice, doubles: double ? s.doubles + 1 : 0 };

    if (s.kolokwium.includes(player)) {
      next = { ...next, kolokwium: s.kolokwium.filter((p) => p !== player) };
      if ((s.passes[player] ?? 0) > 0) {
        // Zaliczenie: wyjście bez rzutu na dublet, karta wraca do talii, dalej zwykły rzut.
        next = log(
          { ...next, passes: { ...next.passes, [player]: s.passes[player] - 1 }, deck: [...next.deck, PASS_CARD] },
          { type: "pass", player, card: PASS_CARD },
        );
      } else if (double) {
        // Zdany dubletem: ruch o oczka, ale bez dodatkowego rzutu.
        next = log({ ...next, doubles: 0 }, { type: "pass", player });
      } else {
        return endTurn(log(next, { type: "fail", player }));
      }
    } else if (next.doubles === 3) {
      return toKolokwium(next, player);
    }

    return land(advance(next, player, dice[0] + dice[1]), player);
  },

  playerView: (s): View => ({
    players: s.players,
    positions: s.positions,
    laps: s.laps,
    cash: s.cash,
    owners: s.owners,
    levels: s.levels,
    bankrupt: s.bankrupt,
    turn: s.phase === "over" ? null : current(s),
    phase: s.phase,
    dice: s.dice,
    round: Math.min(s.round, ROUNDS),
    debt: s.debt,
    events: s.events,
    deckSize: s.deck.length,
    kolokwium: s.kolokwium,
    passes: s.passes,
  }),

  isOver(s) {
    if (s.phase !== "over") return null;
    const alive = s.players.filter((p) => !s.bankrupt.includes(p)).sort((a, b) => wealth(s, b) - wealth(s, a));
    const ranking = [...alive, ...[...s.bankrupt].reverse()];
    return { winner: ranking[0], ranking };
  },

  waitingFor: (s) => (s.phase === "over" ? [] : [current(s)]),

  timeoutMove(s, player) {
    if (s.phase === "buy" || s.phase === "build") return { type: "skip" };
    if (s.phase === "sell") {
      const cheapest = owned(s, player).sort((a, b) => priceOf(a) - priceOf(b) || a - b)[0];
      return { type: "sell", tile: cheapest };
    }
    return { type: "roll" };
  },
};
