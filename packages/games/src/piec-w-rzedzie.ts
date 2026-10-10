import { z } from "zod";
import type { GameDefinition, PlayerId } from "./core.ts";

const SIZE = 15;
const WIN = 5;
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

export type Move = { x: number; y: number };

export interface State {
  players: [PlayerId, PlayerId];
  /** Plansza wiersz po wierszu: indeks gracza (0 albo 1) albo null. */
  board: (0 | 1 | null)[];
  turn: 0 | 1;
  lastMove: Move | null;
  /** Pola zwycięskiej linii, gdy ktoś wygrał. */
  winLine: Move[] | null;
  over: boolean;
}

export type View = Pick<State, "players" | "board" | "turn" | "lastMove" | "winLine"> & { size: number };

const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;

/** Najdłuższa linia gracza przechodząca przez (x, y), jeśli ma co najmniej 5 pól. */
function lineThrough(board: State["board"], x: number, y: number): Move[] | null {
  const who = board[y * SIZE + x];
  for (const [dx, dy] of DIRECTIONS) {
    const line: Move[] = [{ x, y }];
    for (const sign of [1, -1]) {
      let cx = x + dx * sign;
      let cy = y + dy * sign;
      while (inside(cx, cy) && board[cy * SIZE + cx] === who) {
        line.push({ x: cx, y: cy });
        cx += dx * sign;
        cy += dy * sign;
      }
    }
    if (line.length >= WIN) return line;
  }
  return null;
}

export const piecWRzedzie: GameDefinition<State, Move> = {
  id: "piec-w-rzedzie",
  name: "Gomoku",
  minPlayers: 2,
  maxPlayers: 2,
  turnSeconds: 60,
  moveSchema: z.object({ x: z.number().int(), y: z.number().int() }),

  setup(players) {
    return {
      players: [players[0], players[1]],
      board: Array(SIZE * SIZE).fill(null),
      turn: 0,
      lastMove: null,
      winLine: null,
      over: false,
    };
  },

  validateMove(state, player, { x, y }) {
    return (
      !state.over &&
      state.players[state.turn] === player &&
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      inside(x, y) &&
      state.board[y * SIZE + x] === null
    );
  },

  applyMove(state, _player, move) {
    const board = state.board.slice();
    board[move.y * SIZE + move.x] = state.turn;
    const winLine = lineThrough(board, move.x, move.y);
    return {
      ...state,
      board,
      turn: state.turn === 0 ? 1 : 0,
      lastMove: move,
      winLine,
      over: winLine !== null || !board.includes(null),
    };
  },

  playerView: (state): View => ({
    size: SIZE,
    players: state.players,
    board: state.board,
    turn: state.turn,
    lastMove: state.lastMove,
    winLine: state.winLine,
  }),

  isOver(state) {
    if (!state.over) return null;
    // Wygrał ten, kto zrobił ostatni ruch, czyli poprzedni w kolejce.
    return state.winLine ? { winner: state.players[state.turn === 0 ? 1 : 0] } : {};
  },

  waitingFor: (state) => (state.over ? [] : [state.players[state.turn]]),

  timeoutMove(state, _player, rng) {
    const free = state.board.flatMap((cell, i) => (cell === null ? [i] : []));
    const i = free[Math.floor(rng() * free.length)];
    return { x: i % SIZE, y: Math.floor(i / SIZE) };
  },
};
