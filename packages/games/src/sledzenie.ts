import { z } from "zod";
import { type GameDefinition, type PlayerId, ranked } from "./core.ts";

export const BALLS = 8;
export const TARGETS = 3;
export const ROUNDS = 20;
export const SHOW_MS = 1500;
export const MOVE_MS = 5000;
export const RADIUS = 0.06;
export const SPEED_START = 0.3;
export const SPEED_STEP = 0.06;

export type Ball = { x: number; y: number; angle: number };
export type Result = { rounds: number; hits: number };
export type Move = { type: "result"; picks: number[][] };

export interface State {
  players: PlayerId[];
  rounds: Ball[][];
  results: Record<PlayerId, Result>;
}

export type View = State;

const GAP = 2 * RADIUS + 0.02;
const FIELD = 1 - 2 * RADIUS;

function reflectAxis(value: number): number {
  const span = FIELD;
  const wrapped = ((value - RADIUS) % (2 * span) + 2 * span) % (2 * span);
  return wrapped < span ? RADIUS + wrapped : 1 - RADIUS - (wrapped - span);
}

function scatter(rng: () => number, count: number, round: number): Ball[] {
  const items: Ball[] = [];
  while (items.length < count) {
    const ball = {
      x: RADIUS + rng() * FIELD,
      y: RADIUS + rng() * FIELD,
      angle: rng() * Math.PI * 2,
    };
    const startOk = items.every((other) => Math.hypot(ball.x - other.x, ball.y - other.y) >= GAP);
    const end = position(ball, round, MOVE_MS);
    const endOk = items.every((other) => Math.hypot(end.x - position(other, round, MOVE_MS).x, end.y - position(other, round, MOVE_MS).y) >= GAP);
    if (startOk && endOk) items.push(ball);
  }
  return items;
}

export function position(ball: Ball, round: number, t: number): { x: number; y: number } {
  if (t <= 0) return { x: ball.x, y: ball.y };

  const elapsed = Math.min(MOVE_MS, Math.max(0, t));
  const speed = SPEED_START + round * SPEED_STEP;
  const distance = speed * (elapsed / 1000);
  const dx = Math.cos(ball.angle) * distance;
  const dy = Math.sin(ball.angle) * distance;

  return {
    x: reflectAxis(ball.x + dx),
    y: reflectAxis(ball.y + dy),
  };
}

export const sledzenie: GameDefinition<State, Move> = {
  id: "sledzenie",
  name: "Śledzenie",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 300,
  moveSchema: z.object({
    type: z.literal("result"),
    picks: z.array(z.array(z.number().int()).length(TARGETS)).max(ROUNDS),
  }),

  setup: (players, rng) => ({
    players,
    rounds: Array.from({ length: ROUNDS }, (_, round) => scatter(rng, BALLS, round)),
    results: {},
  }),

  validateMove: (state, player, move) => {
    if (!state.players.includes(player) || player in state.results) return false;
    if (move.picks.length === 0) return true;
    if (move.picks.length > ROUNDS) return false;
    return move.picks.every(
      (round) =>
        Array.isArray(round) &&
        round.length === TARGETS &&
        new Set(round).size === TARGETS &&
        round.every((idx) => Number.isInteger(idx) && idx >= 0 && idx < BALLS),
    );
  },

  applyMove: (state, player, move) => {
    const picks = move.picks;
    let rounds = 0;
    let hits = 0;

    for (const round of picks) {
      const inTargets = round.filter((idx) => idx < TARGETS).length;
      if (inTargets === TARGETS) {
        rounds += 1;
        continue;
      }
      hits = inTargets;
      break;
    }

    return {
      ...state,
      results: {
        ...state.results,
        [player]: { rounds, hits },
      },
    };
  },

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, (a, b) => b.rounds - a.rounds || b.hits - a.hits),

  waitingFor: (state) => state.players.filter((player) => !(player in state.results)),

  timeoutMove: () => ({ type: "result", picks: [] }),
};
