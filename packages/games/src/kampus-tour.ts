import { z } from "zod";
import type { GameDefinition, PlayerId, Rng } from "./core.ts";

export const SIZE = 32;
export const ROUNDS = 20;
export const START_CASH = 200;
/** Kieszonkowe za przejście przez Początek dnia. */
export const ALLOWANCE = 20;
const TAX = 15;

/** 8 grup po 3 pola, ceny rosną wzdłuż planszy. Balans: wszystkie kwoty liczone z ceny P. */
export const GROUPS = [
  [1, 2, 3],
  [4, 6, 7],
  [8, 9, 10],
  [12, 14, 15],
  [17, 18, 19],
  [20, 22, 23],
  [24, 25, 26],
  [29, 30, 31],
];
const GROUP_PRICES = [10, 15, 20, 25, 30, 35, 40, 50];

export type Tile =
  | { kind: "start" | "kolokwium" | "juwenalia" | "mpk" | "karty" }
  | { kind: "property"; group: number; price: number }
  | { kind: "tax"; amount: number };
export type TileKind = Tile["kind"];

const SPECIAL: Record<number, Tile> = {
  0: { kind: "start" },
  5: { kind: "karty" },
  11: { kind: "kolokwium" },
  13: { kind: "karty" },
  16: { kind: "juwenalia" },
  21: { kind: "karty" },
  27: { kind: "mpk" },
  28: { kind: "tax", amount: TAX },
};

/** Pola zgodnie z ruchem wskazówek zegara od lewego górnego rogu planszy 12×6. */
export const BOARD: Tile[] = Array.from({ length: SIZE }, (_, i) => {
  const group = GROUPS.findIndex((g) => g.includes(i));
  return group >= 0 ? { kind: "property", group, price: GROUP_PRICES[group] } : SPECIAL[i];
});

export type Move = { type: "roll" } | { type: "buy" } | { type: "skip" } | { type: "sell"; tile: number };

/** Co się wydarzyło w ostatnim ruchu; UI zamienia to na tekst. */
export type Event = {
  type: "allowance" | "buy" | "rent" | "tax" | "sell" | "bankrupt";
  player: PlayerId;
  amount?: number;
  tile?: number;
  to?: PlayerId | null;
};

export interface State {
  players: PlayerId[];
  positions: Record<PlayerId, number>;
  /** Pełne okrążenia (przejścia przez Początek dnia). */
  laps: Record<PlayerId, number>;
  cash: Record<PlayerId, number>;
  owners: Record<number, PlayerId>;
  /** Kolejność odpadania. */
  bankrupt: PlayerId[];
  turn: number;
  phase: "roll" | "buy" | "sell" | "over";
  dice: [number, number] | null;
  /** Dublety z rzędu w tej turze. */
  doubles: number;
  round: number;
  /** Niespłacony czynsz lub opłata (faza sprzedaży); to: null = bank. */
  debt: { amount: number; to: PlayerId | null } | null;
  events: Event[];
}

export type View = Omit<State, "turn" | "doubles"> & { turn: PlayerId | null };

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll") }),
  z.object({ type: z.literal("buy") }),
  z.object({ type: z.literal("skip") }),
  z.object({ type: z.literal("sell"), tile: z.number().int().min(0).max(SIZE - 1) }),
]);

const current = (s: State) => s.players[s.turn];
const priceOf = (tile: number) => {
  const t = BOARD[tile];
  return t.kind === "property" ? t.price : 0;
};
const saleValue = (tile: number) => Math.floor(priceOf(tile) / 2);
const owned = (s: State, p: PlayerId) => Object.keys(s.owners).map(Number).filter((i) => s.owners[i] === p);
const wealth = (s: State, p: PlayerId) => s.cash[p] + owned(s, p).reduce((sum, i) => sum + priceOf(i), 0);

/** Czynsz P/10; cała grupa w rękach jednego właściciela podwaja go. */
export function rent(owners: Record<number, PlayerId>, tile: number): number {
  const t = BOARD[tile];
  if (t.kind !== "property") return 0;
  const base = Math.round(t.price / 10);
  return GROUPS[t.group].every((i) => owners[i] === owners[tile]) ? base * 2 : base;
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

function goBankrupt(s: State, player: PlayerId, to: PlayerId | null): State {
  const cash = { ...s.cash, [player]: 0 };
  if (to) cash[to] += s.cash[player];
  const owners = Object.fromEntries(Object.entries(s.owners).filter(([, p]) => p !== player));
  const next: State = {
    ...s,
    cash,
    owners,
    debt: null,
    bankrupt: [...s.bankrupt, player],
    events: [...s.events, { type: "bankrupt", player }],
  };
  return next.players.length - next.bankrupt.length <= 1 ? { ...next, phase: "over" } : endTurn(next);
}

/** Płatność z sprzedażą pól albo bankructwem, gdy gotówki brakuje. */
function pay(s: State, player: PlayerId, amount: number, to: PlayerId | null): State {
  if (s.cash[player] >= amount) {
    const cash = { ...s.cash, [player]: s.cash[player] - amount };
    if (to) cash[to] += amount;
    return finish({ ...s, cash, debt: null });
  }
  const assets = owned(s, player).reduce((sum, i) => sum + saleValue(i), 0);
  if (s.cash[player] + assets >= amount) return { ...s, phase: "sell", debt: { amount, to } };
  return goBankrupt(s, player, to);
}

function land(s: State, player: PlayerId): State {
  const pos = s.positions[player];
  const tile = BOARD[pos];
  if (tile.kind === "tax") return pay({ ...s, events: [...s.events, { type: "tax", player, amount: tile.amount }] }, player, tile.amount, null);
  if (tile.kind !== "property") return finish(s);

  const owner = s.owners[pos];
  if (!owner) return s.cash[player] >= tile.price ? { ...s, phase: "buy" } : finish(s);
  if (owner === player) return finish(s);
  const amount = rent(s.owners, pos);
  return pay({ ...s, events: [...s.events, { type: "rent", player, amount, tile: pos, to: owner }] }, player, amount, owner);
}

export const kampusTour: GameDefinition<State, Move> = {
  id: "kampus-tour",
  name: "Kampus Tour",
  minPlayers: 2,
  maxPlayers: 4,
  turnSeconds: 60,
  moveSchema,

  setup: (players) => ({
    players,
    positions: Object.fromEntries(players.map((p) => [p, 0])),
    laps: Object.fromEntries(players.map((p) => [p, 0])),
    cash: Object.fromEntries(players.map((p) => [p, START_CASH])),
    owners: {},
    bankrupt: [],
    turn: 0,
    phase: "roll",
    dice: null,
    doubles: 0,
    round: 1,
    debt: null,
    events: [],
  }),

  validateMove(s, player, move) {
    if (s.phase === "over" || current(s) !== player) return false;
    if (move.type === "roll") return s.phase === "roll";
    if (move.type === "sell") return s.phase === "sell" && s.owners[move.tile] === player;
    return s.phase === "buy";
  },

  applyMove(s, player, move, rng: Rng) {
    if (move.type === "skip") return finish(s);

    if (move.type === "buy") {
      const tile = s.positions[player];
      const amount = priceOf(tile);
      return finish({
        ...s,
        owners: { ...s.owners, [tile]: player },
        cash: { ...s.cash, [player]: s.cash[player] - amount },
        events: [...s.events, { type: "buy", player, amount, tile }],
      });
    }

    if (move.type === "sell") {
      const owners = { ...s.owners };
      delete owners[move.tile];
      const amount = saleValue(move.tile);
      const next: State = {
        ...s,
        owners,
        cash: { ...s.cash, [player]: s.cash[player] + amount },
        events: [...s.events, { type: "sell", player, amount, tile: move.tile }],
      };
      const debt = s.debt!;
      return next.cash[player] >= debt.amount ? pay(next, player, debt.amount, debt.to) : next;
    }

    const dice: [number, number] = [Math.floor(rng() * 6) + 1, Math.floor(rng() * 6) + 1];
    const to = s.positions[player] + dice[0] + dice[1];
    const passed = Math.floor(to / SIZE);
    const events: Event[] = passed ? [{ type: "allowance", player, amount: passed * ALLOWANCE }] : [];
    return land(
      {
        ...s,
        dice,
        doubles: dice[0] === dice[1] ? s.doubles + 1 : 0,
        positions: { ...s.positions, [player]: to % SIZE },
        laps: { ...s.laps, [player]: s.laps[player] + passed },
        cash: { ...s.cash, [player]: s.cash[player] + passed * ALLOWANCE },
        events,
      },
      player,
    );
  },

  playerView: (s): View => ({
    players: s.players,
    positions: s.positions,
    laps: s.laps,
    cash: s.cash,
    owners: s.owners,
    bankrupt: s.bankrupt,
    turn: s.phase === "over" ? null : current(s),
    phase: s.phase,
    dice: s.dice,
    round: Math.min(s.round, ROUNDS),
    debt: s.debt,
    events: s.events,
  }),

  isOver(s) {
    if (s.phase !== "over") return null;
    const alive = s.players.filter((p) => !s.bankrupt.includes(p)).sort((a, b) => wealth(s, b) - wealth(s, a));
    const ranking = [...alive, ...[...s.bankrupt].reverse()];
    return { winner: ranking[0], ranking };
  },

  waitingFor: (s) => (s.phase === "over" ? [] : [current(s)]),

  timeoutMove(s, player) {
    if (s.phase === "buy") return { type: "skip" };
    if (s.phase === "sell") {
      const cheapest = owned(s, player).sort((a, b) => priceOf(a) - priceOf(b) || a - b)[0];
      return { type: "sell", tile: cheapest };
    }
    return { type: "roll" };
  },
};
