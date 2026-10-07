import { z } from "zod";
import type { GameDefinition, PlayerId, Rng } from "./core.ts";

export const SIZE = 10;
/** Jedna czwórka, dwie trójki, trzy dwójki, cztery jedynki. */
export const FLEET_LENGTHS = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

export type Ship = { x: number; y: number; length: number; vertical: boolean };
export type Shot = { x: number; y: number; result: "miss" | "hit" | "sunk" | "around" };

interface Board {
  ships: Ship[];
  ready: boolean;
  /** Strzały oddane w tę planszę (i pola oznaczone wokół zatopionych statków). */
  shots: Shot[];
}

export interface State {
  players: [PlayerId, PlayerId];
  boards: Record<PlayerId, Board>;
  phase: "placing" | "battle" | "over";
  shooter: 0 | 1;
  winner: PlayerId | null;
}

export interface View {
  phase: State["phase"];
  players: [PlayerId, PlayerId];
  shooter: PlayerId | null;
  /** Właściciel widzi wszystkie swoje statki; pozostali tylko zatopione. */
  boards: Record<PlayerId, { ships: Ship[]; shots: Shot[]; ready: boolean }>;
}

const shipSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  length: z.number().int(),
  vertical: z.boolean(),
});

export type Move = { type: "place"; ships: Ship[] } | { type: "ready" } | { type: "shoot"; x: number; y: number };

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("place"), ships: z.array(shipSchema).max(FLEET_LENGTHS.length) }),
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("shoot"), x: z.number().int(), y: z.number().int() }),
]);

const inside = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE;

export const shipCells = (ship: Ship) =>
  Array.from({ length: ship.length }, (_, i) => ({
    x: ship.x + (ship.vertical ? 0 : i),
    y: ship.y + (ship.vertical ? i : 0),
  }));

/** Pola dookoła statku (także po skosie), bez pól samego statku i bez wyjścia poza planszę. */
function around(ship: Ship) {
  const own = new Set(shipCells(ship).map((c) => c.y * SIZE + c.x));
  const result = new Map<number, { x: number; y: number }>();
  for (const c of shipCells(ship)) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = c.x + dx;
        const y = c.y + dy;
        if (inside(x, y) && !own.has(y * SIZE + x)) result.set(y * SIZE + x, { x, y });
      }
    }
  }
  return [...result.values()];
}

/** Czy statek mieści się na planszy i nie dotyka (także rogiem) żadnego z już postawionych. */
function fits(ship: Ship, placed: Ship[]) {
  if (!shipCells(ship).every((c) => inside(c.x, c.y))) return false;
  const blocked = new Set(placed.flatMap((s) => [...shipCells(s), ...around(s)]).map((c) => c.y * SIZE + c.x));
  return shipCells(ship).every((c) => !blocked.has(c.y * SIZE + c.x));
}

export function isValidFleet(ships: Ship[]): boolean {
  const lengths = ships.map((s) => s.length).sort((a, b) => b - a);
  if (lengths.join() !== FLEET_LENGTHS.join()) return false;
  return ships.every((ship, i) => fits(ship, ships.slice(0, i)));
}

export function randomFleet(rng: Rng): Ship[] {
  // ponytail: losowanie z ponawianiem; przy tej flocie na 10×10 prawie zawsze udaje się za pierwszym razem
  for (;;) {
    const placed: Ship[] = [];
    for (const length of FLEET_LENGTHS) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const vertical = rng() < 0.5;
        const ship = {
          x: Math.floor(rng() * (vertical ? SIZE : SIZE - length + 1)),
          y: Math.floor(rng() * (vertical ? SIZE - length + 1 : SIZE)),
          length,
          vertical,
        };
        if (fits(ship, placed)) {
          placed.push(ship);
          break;
        }
      }
    }
    if (placed.length === FLEET_LENGTHS.length) return placed;
  }
}

const opponent = (state: State, player: PlayerId) => state.players.find((p) => p !== player)!;
const shotAt = (board: Board, x: number, y: number) => board.shots.find((s) => s.x === x && s.y === y);
const isSunk = (ship: Ship, shots: Shot[]) =>
  shipCells(ship).every((c) => shots.some((s) => s.x === c.x && s.y === c.y && s.result !== "miss" && s.result !== "around"));

export const statki: GameDefinition<State, Move> = {
  id: "statki",
  name: "Statki",
  minPlayers: 2,
  maxPlayers: 2,
  turnSeconds: 60,
  moveSchema,

  setup(players, rng) {
    const [a, b] = players;
    const board = (): Board => ({ ships: randomFleet(rng), ready: false, shots: [] });
    return { players: [a, b], boards: { [a]: board(), [b]: board() }, phase: "placing", shooter: 0, winner: null };
  },

  validateMove(state, player, move) {
    const board = state.boards[player];
    if (!board) return false;
    switch (move.type) {
      case "place":
        return state.phase === "placing" && !board.ready && isValidFleet(move.ships);
      case "ready":
        return state.phase === "placing" && !board.ready;
      case "shoot":
        return (
          state.phase === "battle" &&
          state.players[state.shooter] === player &&
          inside(move.x, move.y) &&
          !shotAt(state.boards[opponent(state, player)], move.x, move.y)
        );
    }
  },

  applyMove(state, player, move) {
    const board = state.boards[player];
    if (move.type === "place") {
      return { ...state, boards: { ...state.boards, [player]: { ...board, ships: move.ships.map((s) => ({ ...s })) } } };
    }
    if (move.type === "ready") {
      const boards = { ...state.boards, [player]: { ...board, ready: true } };
      const allReady = state.players.every((p) => boards[p].ready);
      return { ...state, boards, phase: allReady ? "battle" : "placing", shooter: 0 };
    }

    const target = opponent(state, player);
    const enemy = state.boards[target];
    const ship = enemy.ships.find((s) => shipCells(s).some((c) => c.x === move.x && c.y === move.y));
    if (!ship) {
      const shots = [...enemy.shots, { x: move.x, y: move.y, result: "miss" as const }];
      return { ...state, boards: { ...state.boards, [target]: { ...enemy, shots } }, shooter: state.shooter === 0 ? 1 : 0 };
    }

    let shots: Shot[] = [...enemy.shots, { x: move.x, y: move.y, result: "hit" }];
    if (isSunk(ship, shots)) {
      const own = new Set(shipCells(ship).map((c) => `${c.x},${c.y}`));
      shots = shots.map((s) => (own.has(`${s.x},${s.y}`) ? { ...s, result: "sunk" } : s));
      for (const c of around(ship)) if (!shotAt({ ...enemy, shots }, c.x, c.y)) shots.push({ ...c, result: "around" });
    }
    const allSunk = enemy.ships.every((s) => isSunk(s, shots));
    // Trafienie: ten sam gracz strzela dalej.
    return {
      ...state,
      boards: { ...state.boards, [target]: { ...enemy, shots } },
      phase: allSunk ? "over" : "battle",
      winner: allSunk ? player : null,
    };
  },

  playerView(state, viewer): View {
    const boards: View["boards"] = {};
    for (const id of state.players) {
      const b = state.boards[id];
      boards[id] = {
        ships: id === viewer ? b.ships : b.ships.filter((s) => isSunk(s, b.shots)),
        shots: b.shots,
        ready: b.ready,
      };
    }
    return {
      phase: state.phase,
      players: state.players,
      shooter: state.phase === "battle" ? state.players[state.shooter] : null,
      boards,
    };
  },

  isOver: (state) => (state.phase === "over" ? { winner: state.winner! } : null),

  waitingFor(state) {
    if (state.phase === "placing") return state.players.filter((p) => !state.boards[p].ready);
    if (state.phase === "battle") return [state.players[state.shooter]];
    return [];
  },

  timeoutMove(state, player, rng) {
    if (state.phase === "placing") return { type: "ready" };
    const enemy = state.boards[opponent(state, player)];
    const free: { x: number; y: number }[] = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!shotAt(enemy, x, y)) free.push({ x, y });
    const cell = free[Math.floor(rng() * free.length)];
    return { type: "shoot", ...cell };
  },
};
