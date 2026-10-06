export type PlayerId = string;

/** Zwraca liczbę z przedziału [0, 1). */
export type Rng = () => number;

export interface GameDefinition<State, Move> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  setup(players: PlayerId[], rng: Rng): State;
  validateMove(state: State, player: PlayerId, move: Move): boolean;
  applyMove(state: State, player: PlayerId, move: Move, rng: Rng): State;
  /** Widok stanu dla konkretnego gracza: tu ukrywamy informacje. */
  playerView(state: State, player: PlayerId): unknown;
  isOver(state: State): { winner?: PlayerId; ranking?: PlayerId[] } | null;
}

/** mulberry32: mały, deterministyczny generator. Ten sam seed daje ten sam ciąg (testy, powtórki). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bez O/0, I/1/L, żeby kod dało się bezbłędnie przepisać z ekranu kolegi. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 4;

export function roomCode(rng: Rng): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
