import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults, shuffle } from "./core.ts";

/** Liczba różnych symboli; ekran ma tyle ikon (`ICONS` w Memory.tsx). */
export const SYMBOLS = 18;

/** Tryby do wyboru w lobby, od najkrótszej partii do najdłuższej. Liczba rzędów wynika z `pairs * 2 / cols`. */
export const MODES = [
  { id: "mala", name: "Mała", hint: "4×4, 8 par, szybka partia", cols: 4, pairs: 8 },
  { id: "srednia", name: "Średnia", hint: "4×6, 12 par", cols: 4, pairs: 12, default: true },
  { id: "duza", name: "Duża", hint: "6×6, 18 par, długa partia", cols: 6, pairs: 18 },
];
const DEFAULT = MODES.find((m) => m.default)!;

export type Move = { card: number };

export interface State {
  /** Id trybu z MODES. */
  mode: string;
  players: PlayerId[];
  /** Symbol (0 do SYMBOLS − 1) każdej karty, wiersz po wierszu. Tego nie widzi nikt poza serwerem. */
  cards: number[];
  /** Kto zebrał kartę; null = leży na planszy. */
  owner: (PlayerId | null)[];
  /** Indeks gracza na ruchu. */
  turn: number;
  /** Pierwsza odkryta karta tury. */
  first: number | null;
  /** Karty ostatniego pudła; znikają przy następnym odkryciu. */
  miss: [number, number] | null;
}

export interface View {
  mode: string;
  cols: number;
  players: PlayerId[];
  turn: number;
  /** Symbol karty albo null, gdy zakryta: widać tylko zebrane, `first` i `miss`. */
  faces: (number | null)[];
  owner: State["owner"];
  first: State["first"];
  miss: State["miss"];
}

const over = (state: State) => state.owner.every((o) => o !== null);

export const memory: GameDefinition<State, Move> = {
  id: "memory",
  name: "Memory",
  minPlayers: 2,
  maxPlayers: 6,
  turnSeconds: 60,
  modes: MODES,
  moveSchema: z.object({ card: z.number().int() }),

  setup(players, rng, mode) {
    const { id, pairs } = MODES.find((m) => m.id === mode) ?? DEFAULT;
    const symbols = shuffle(Array.from({ length: SYMBOLS }, (_, i) => i), rng).slice(0, pairs);
    const cards = shuffle([...symbols, ...symbols], rng);
    return { mode: id, players: [...players], cards, owner: cards.map(() => null), turn: 0, first: null, miss: null };
  },

  validateMove(state, player, { card }) {
    // `owner[card] === null` odrzuca też indeks spoza planszy i niecałkowity (undefined).
    return !over(state) && state.players[state.turn] === player && state.owner[card] === null && card !== state.first;
  },

  applyMove(state, player, { card }) {
    const { first } = state;
    if (first === null) return { ...state, first: card, miss: null };
    if (state.cards[first] !== state.cards[card]) {
      return { ...state, first: null, miss: [first, card], turn: (state.turn + 1) % state.players.length };
    }
    return { ...state, first: null, owner: state.owner.map((o, i) => (i === first || i === card ? player : o)) };
  },

  playerView: (state): View => ({
    mode: state.mode,
    cols: (MODES.find((m) => m.id === state.mode) ?? DEFAULT).cols,
    players: state.players,
    turn: state.turn,
    faces: state.cards.map((symbol, i) => (state.owner[i] !== null || i === state.first || state.miss?.includes(i) ? symbol : null)),
    owner: state.owner,
    first: state.first,
    miss: state.miss,
  }),

  isOver(state) {
    if (!over(state)) return null;
    const pairs = Object.fromEntries(state.players.map((p) => [p, state.owner.filter((o) => o === p).length]));
    return rankResults(state.players, pairs, (a, b) => b - a);
  },

  waitingFor: (state) => (over(state) ? [] : [state.players[state.turn]]),

  timeoutMove(state, _player, rng) {
    const free = state.owner.flatMap((o, i) => (o === null && i !== state.first ? [i] : []));
    return { card: free[Math.floor(rng() * free.length)] };
  },
};
