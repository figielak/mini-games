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
  /** Widok stanu dla konkretnego gracza — tu ukrywamy informacje. */
  playerView(state: State, player: PlayerId): unknown;
  isOver(state: State): { winner?: PlayerId; ranking?: PlayerId[] } | null;
}
