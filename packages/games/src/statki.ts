import { z } from "zod";
import type { GameDefinition, PlayerId, Rng } from "./core.ts";

/** Reguły trybu: rozmiar planszy, długości statków (malejąco) i czy statki mogą się stykać. */
export interface Rules {
  id: string;
  name: string;
  hint: string;
  size: number;
  lengths: number[];
  touching: boolean;
  default?: boolean;
}

/** Tryby do wyboru w lobby, od najkrótszej partii do najdłuższej (po liczbie pól floty). */
export const MODES: Rules[] = [
  { id: "szybki", name: "Szybki", hint: "8×8, 4 statki, partia na kilka minut", size: 8, lengths: [4, 3, 2, 2], touching: false },
  { id: "hasbro", name: "Hasbro", hint: "10×10, 5 statków, mogą się stykać", size: 10, lengths: [5, 4, 3, 3, 2], touching: true },
  { id: "klasyczny", name: "Klasyczny", hint: "10×10, 10 statków, dużo jedynek", size: 10, lengths: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], touching: false, default: true },
  { id: "flota", name: "Flota wojenna", hint: "12×12, 8 dużych statków, długa partia", size: 12, lengths: [6, 5, 4, 4, 3, 3, 2, 2], touching: false },
];
const DEFAULT = MODES.find((m) => m.default)!;
const MAX_SHIPS = Math.max(...MODES.map((m) => m.lengths.length));
/** Jeden limit na całe rozstawianie; nie odnawia się, więc gotowość można cofać bez przeciągania partii. */
export const PLACING_SECONDS = 90;

export type Ship = { x: number; y: number; length: number; vertical: boolean };
export type Shot = { x: number; y: number; result: "miss" | "hit" | "sunk" | "around" };

interface Board {
  ships: Ship[];
  ready: boolean;
  /** Strzały oddane w tę planszę (i pola oznaczone wokół zatopionych statków). */
  shots: Shot[];
}

export interface State {
  /** Id trybu z MODES. */
  mode: string;
  players: [PlayerId, PlayerId];
  boards: Record<PlayerId, Board>;
  phase: "placing" | "battle" | "over";
  shooter: 0 | 1;
  winner: PlayerId | null;
}

export interface View {
  mode: string;
  size: number;
  lengths: number[];
  touching: boolean;
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

export type Move = { type: "place"; ships: Ship[] } | { type: "ready" } | { type: "unready" } | { type: "shoot"; x: number; y: number };

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("place"), ships: z.array(shipSchema).max(MAX_SHIPS) }),
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("unready") }),
  z.object({ type: z.literal("shoot"), x: z.number().int(), y: z.number().int() }),
]);

const rules = (state: State) => MODES.find((m) => m.id === state.mode) ?? DEFAULT;

const inside = (x: number, y: number, size: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;

export const shipCells = (ship: Ship) =>
  Array.from({ length: ship.length }, (_, i) => ({
    x: ship.x + (ship.vertical ? 0 : i),
    y: ship.y + (ship.vertical ? i : 0),
  }));

/** Pola dookoła statku (także po skosie), bez pól samego statku i bez wyjścia poza planszę. */
export function around(ship: Ship, size: number) {
  const own = new Set(shipCells(ship).map((c) => c.y * size + c.x));
  const result = new Map<number, { x: number; y: number }>();
  for (const c of shipCells(ship)) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = c.x + dx;
        const y = c.y + dy;
        if (inside(x, y, size) && !own.has(y * size + x)) result.set(y * size + x, { x, y });
      }
    }
  }
  return [...result.values()];
}

/** Czy statek mieści się na planszy i nie koliduje z już postawionymi: bez stykania także rogiem, ze stykaniem tylko bez nakładania. */
function fits(ship: Ship, placed: Ship[], { size, touching }: Rules) {
  if (!shipCells(ship).every((c) => inside(c.x, c.y, size))) return false;
  const blocked = new Set(placed.flatMap((s) => [...shipCells(s), ...(touching ? [] : around(s, size))]).map((c) => c.y * size + c.x));
  return shipCells(ship).every((c) => !blocked.has(c.y * size + c.x));
}

export function isValidFleet(ships: Ship[], mode: Rules = DEFAULT): boolean {
  const lengths = ships.map((s) => s.length).sort((a, b) => b - a);
  if (lengths.join() !== mode.lengths.join()) return false;
  return ships.every((ship, i) => fits(ship, ships.slice(0, i), mode));
}

export function randomFleet(rng: Rng, mode: Rules = DEFAULT): Ship[] {
  const { size } = mode;
  // ponytail: losowanie z ponawianiem; przy tych flotach prawie zawsze udaje się za pierwszym razem
  for (;;) {
    const placed: Ship[] = [];
    for (const length of mode.lengths) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const vertical = rng() < 0.5;
        const ship = {
          x: Math.floor(rng() * (vertical ? size : size - length + 1)),
          y: Math.floor(rng() * (vertical ? size - length + 1 : size)),
          length,
          vertical,
        };
        if (fits(ship, placed, mode)) {
          placed.push(ship);
          break;
        }
      }
    }
    if (placed.length === mode.lengths.length) return placed;
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
  modes: MODES,

  setup(players, rng, modeId) {
    const [a, b] = players;
    const mode = MODES.find((m) => m.id === modeId) ?? DEFAULT;
    const board = (): Board => ({ ships: randomFleet(rng, mode), ready: false, shots: [] });
    return { mode: mode.id, players: [a, b], boards: { [a]: board(), [b]: board() }, phase: "placing", shooter: 0, winner: null };
  },

  validateMove(state, player, move) {
    const board = state.boards[player];
    if (!board) return false;
    switch (move.type) {
      case "place":
        return state.phase === "placing" && !board.ready && isValidFleet(move.ships, rules(state));
      case "ready":
        return state.phase === "placing" && !board.ready;
      case "unready":
        return state.phase === "placing" && board.ready;
      case "shoot":
        return (
          state.phase === "battle" &&
          state.players[state.shooter] === player &&
          inside(move.x, move.y, rules(state).size) &&
          !shotAt(state.boards[opponent(state, player)], move.x, move.y)
        );
    }
  },

  applyMove(state, player, move) {
    const board = state.boards[player];
    if (move.type === "place") {
      return { ...state, boards: { ...state.boards, [player]: { ...board, ships: move.ships.map((s) => ({ ...s })) } } };
    }
    if (move.type === "unready") {
      return { ...state, boards: { ...state.boards, [player]: { ...board, ready: false } } };
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
      // Ze stykaniem pól wokół się nie oznacza: może tam stać inny statek.
      const { size, touching } = rules(state);
      if (!touching) for (const c of around(ship, size)) if (!shotAt({ ...enemy, shots }, c.x, c.y)) shots.push({ ...c, result: "around" });
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
    const { id: mode, size, lengths, touching } = rules(state);
    return {
      mode,
      size,
      lengths,
      touching,
      phase: state.phase,
      players: state.players,
      shooter: state.phase === "battle" ? state.players[state.shooter] : null,
      boards,
    };
  },

  isOver: (state) => (state.phase === "over" ? { winner: state.winner! } : null),

  // Rozstawianie: jeden licznik na całą fazę (stały klucz). W bitwie od nowa po każdym strzale.
  turn: (state) => ({
    key: state.phase === "placing" ? "placing" : `${state.phase}:${state.players.reduce((n, p) => n + state.boards[p].shots.length, 0)}`,
    seconds: state.phase === "placing" ? PLACING_SECONDS : state.phase === "over" ? 0 : statki.turnSeconds!,
  }),

  waitingFor(state) {
    if (state.phase === "placing") return state.players.filter((p) => !state.boards[p].ready);
    if (state.phase === "battle") return [state.players[state.shooter]];
    return [];
  },

  timeoutMove(state, player, rng) {
    if (state.phase === "placing") return { type: "ready" };
    const enemy = state.boards[opponent(state, player)];
    const free: { x: number; y: number }[] = [];
    const { size } = rules(state);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!shotAt(enemy, x, y)) free.push({ x, y });
    const cell = free[Math.floor(rng() * free.length)];
    return { type: "shoot", ...cell };
  },
};
