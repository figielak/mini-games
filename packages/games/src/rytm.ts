import { z } from "zod";
import { type GameDefinition, type PlayerId, ranked } from "./core.ts";

/** Tyle uderzeń gra metronom, zanim ucichnie (2 takty po 4). */
export const BEATS = 8;
/** Tyle trwa stukanie, licząc od ostatniego uderzenia metronomu. */
export const TAP_MS = 10_000;
const BPM_MIN = 70;
const BPM_MAX = 130;
const BPM_STEP = 5;
export const MAX_TAPS = 60;

/** Czasy stuknięć w ms od ostatniego uderzenia metronomu. */
export type Move = { type: "result"; taps: number[] };

export interface State {
  players: PlayerId[];
  /** Odstęp między uderzeniami metronomu w ms, ten sam dla wszystkich. */
  interval: number;
  /** Nic nie losuje, tylko odróżnia partie (rewanż może wylosować to samo tempo). */
  nonce: number;
  /** Średnia odchyłka odstępów w ms. */
  results: Record<PlayerId, number>;
}

export type View = State;

/** Ile odstępów powinien oddać gracz: jedno uderzenie zapasu, żeby grający odrobinę za wolno nie tracił ostatniego o włos. */
export const expected = (interval: number) => Math.floor(TAP_MS / interval) - 1;

/** Średnia odchyłka odstępów od odstępu metronomu; błąd odstępu ucięty do `interval`, brakujące odstępy liczą się jak najgorsze. */
export function deviation(interval: number, taps: number[]): number {
  const count = Math.max(expected(interval), taps.length);
  const sum = taps.reduce((acc, t, i) => acc + Math.min(interval, Math.abs(t - (taps[i - 1] ?? 0) - interval)), 0);
  return Math.round((sum + (count - taps.length) * interval) / count);
}

// ponytail: stuknięcia mierzy klient (opóźnienie Wi-Fi zjadłoby pomiar), da się je podrobić;
// serwer zna tempo, więc sam liczy odchyłkę z surowych czasów.
export const rytm: GameDefinition<State, Move> = {
  id: "rytm",
  name: "Rytm",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 60,
  moveSchema: z.object({ type: z.literal("result"), taps: z.array(z.number().int()).max(MAX_TAPS) }),

  setup: (players, rng) => ({
    players,
    interval: Math.round(60_000 / (BPM_MIN + BPM_STEP * Math.floor(rng() * ((BPM_MAX - BPM_MIN) / BPM_STEP + 1)))),
    nonce: Math.floor(rng() * 2 ** 32),
    results: {},
  }),

  validateMove: (state, player, { taps }) =>
    state.players.includes(player) &&
    !(player in state.results) &&
    taps.length <= MAX_TAPS &&
    taps.every((t, i) => Number.isInteger(t) && t > (taps[i - 1] ?? 0) && t <= TAP_MS),

  applyMove: (state, player, { taps }) => ({ ...state, results: { ...state.results, [player]: deviation(state.interval, taps) } }),

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, (a, b) => a - b),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", taps: [] }),
};
