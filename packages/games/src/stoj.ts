import { z } from "zod";
import { byScoreThenAverage, type GameDefinition, type PlayerId, rankResults, shuffle } from "./core.ts";

export const DURATION_MS = 30_000;
/** Odstęp między bodźcami maleje liniowo z czasem partii: to jest „tempo rośnie”. */
const START_INTERVAL_MS = 1000;
const END_INTERVAL_MS = 500;
/** Przez taką część odstępu bodziec świeci; dotknięcie liczy się do pojawienia się następnego. */
export const VISIBLE = 0.6;
const MIN_REACTION_MS = 100;
const ERROR_COST = 2;

/** Stały harmonogram: kiedy pojawia się bodziec (ms od startu) i ile jest czasu na reakcję. Ostatni kończy się przed 30 s. */
export const SCHEDULE: { at: number; window: number }[] = [];
for (let at = 0; ; ) {
  const window = Math.round(START_INTERVAL_MS - ((START_INTERVAL_MS - END_INTERVAL_MS) * at) / DURATION_MS);
  if (at + window > DURATION_MS) break;
  SCHEDULE.push({ at, window });
  at += window;
}

/** Czasy reakcji na zielone i liczba dotkniętych czerwonych. */
export type Result = { times: number[]; errors: number };
/** `taps[i]` to czas reakcji na bodziec `i` w ms albo null, gdy gracz go nie dotknął. */
export type Move = { type: "result"; taps: (number | null)[] };

export interface State {
  players: PlayerId[];
  /** Które bodźce są czerwone, ta sama kolejność dla wszystkich. */
  reds: boolean[];
  results: Record<PlayerId, Result>;
}

export type View = State;

export const score = ({ times, errors }: Result) => Math.max(0, times.length - ERROR_COST * errors);

// ponytail: reakcje mierzy klient (opóźnienie Wi-Fi zjadłoby pomiar), da się je podrobić;
// serwer zna kolejność bodźców, więc sam liczy trafienia i błędy i odrzuca nierealne czasy.
export const stoj: GameDefinition<State, Move> = {
  id: "stoj",
  name: "Stój!",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 60,
  moveSchema: z.object({
    type: z.literal("result"),
    taps: z.array(z.number().int().nullable()).max(SCHEDULE.length),
  }),

  setup: (players, rng) => ({
    players,
    // Co trzeci czerwony: klepanie na oślep daje wtedy około zera (N − 3 × czerwone).
    reds: shuffle(
      SCHEDULE.map((_, i) => i < Math.round(SCHEDULE.length / 3)),
      rng,
    ),
    results: {},
  }),

  validateMove: (state, player, { taps }) =>
    state.players.includes(player) &&
    !(player in state.results) &&
    taps.length <= SCHEDULE.length &&
    taps.every((t, i) => t === null || (t >= MIN_REACTION_MS && t <= SCHEDULE[i].window)),

  applyMove: (state, player, { taps }) => ({
    ...state,
    results: {
      ...state.results,
      [player]: {
        times: taps.filter((t, i): t is number => t !== null && !state.reds[i]),
        errors: taps.filter((t, i) => t !== null && state.reds[i]).length,
      },
    },
  }),

  playerView: (state): View => state,

  isOver: (state) => rankResults(state.players, state.results, byScoreThenAverage(score)),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", taps: [] }),
};
