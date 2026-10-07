import { z } from "zod";
import type { GameDefinition, PlayerId, Rng } from "./core.ts";

export const SIZE = 32;
export const ROUNDS = 20;

export type TileKind = "start" | "kolokwium" | "juwenalia" | "mpk" | "karty" | "empty";
export type Tile = { kind: TileKind };

const SPECIAL: Record<number, TileKind> = { 0: "start", 5: "karty", 11: "kolokwium", 13: "karty", 16: "juwenalia", 21: "karty", 27: "mpk" };

/** Pola zgodnie z ruchem wskazówek zegara od lewego górnego rogu planszy 12×6. */
export const BOARD: Tile[] = Array.from({ length: SIZE }, (_, i) => ({ kind: SPECIAL[i] ?? "empty" }));

export type Move = { type: "roll" };

export interface State {
  players: PlayerId[];
  positions: Record<PlayerId, number>;
  /** Pełne okrążenia (przejścia przez Początek dnia). */
  laps: Record<PlayerId, number>;
  turn: number;
  phase: "roll" | "over";
  dice: [number, number] | null;
  /** Dublety z rzędu w tej turze. */
  doubles: number;
  round: number;
}

export type View = Omit<State, "turn" | "doubles"> & { turn: PlayerId | null };

const moveSchema = z.object({ type: z.literal("roll") });

const current = (s: State) => s.players[s.turn];
const progress = (s: State, p: PlayerId) => s.laps[p] * SIZE + s.positions[p];

function endTurn(s: State): State {
  const turn = (s.turn + 1) % s.players.length;
  const round = turn === 0 ? s.round + 1 : s.round;
  return { ...s, turn, round, doubles: 0, phase: round > ROUNDS ? "over" : "roll" };
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
    turn: 0,
    phase: "roll",
    dice: null,
    doubles: 0,
    round: 1,
  }),

  validateMove: (s, player) => s.phase === "roll" && current(s) === player,

  applyMove(s, player, _move, rng: Rng) {
    const dice: [number, number] = [Math.floor(rng() * 6) + 1, Math.floor(rng() * 6) + 1];
    const to = s.positions[player] + dice[0] + dice[1];
    const doubles = dice[0] === dice[1] ? s.doubles + 1 : 0;
    const next: State = {
      ...s,
      dice,
      doubles,
      positions: { ...s.positions, [player]: to % SIZE },
      laps: { ...s.laps, [player]: s.laps[player] + Math.floor(to / SIZE) },
    };
    // Dublet: kolejny rzut, ale trzeci z rzędu kończy turę.
    return doubles > 0 && doubles < 3 ? next : endTurn(next);
  },

  playerView: (s): View => ({
    players: s.players,
    positions: s.positions,
    laps: s.laps,
    turn: s.phase === "over" ? null : current(s),
    phase: s.phase,
    dice: s.dice,
    round: Math.min(s.round, ROUNDS),
  }),

  isOver(s) {
    if (s.phase !== "over") return null;
    // ponytail: postęp na planszy zamiast majątku, dopóki nie ma pieniędzy
    const ranking = [...s.players].sort((a, b) => progress(s, b) - progress(s, a));
    return { winner: ranking[0], ranking };
  },

  waitingFor: (s) => (s.phase === "over" ? [] : [current(s)]),

  timeoutMove: () => ({ type: "roll" }),
};
