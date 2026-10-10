import { byHitsThenAverage, type GameDefinition, type PlayerId, ranked } from "./core.ts";
import { QUESTIONS, type QuizMove, quizMoveSchema, type QuizResult, validQuiz } from "./quiz.ts";

/** Największy bok siatki: przy 360 px szerokości kafel ma wtedy jeszcze 48 px. */
export const MAX_SIDE = 6;
/** Numer planszy, od którego różnica już nie maleje. */
export const HARD = 16;
/** Różnica obrotu w stopniach, jasności w punktach HSL i rozmiaru w punktach %: od MAX na planszy 0 do MIN na planszy HARD. */
export const ANGLE_MAX = 40;
export const ANGLE_MIN = 8;
export const LIGHT_MAX = 20;
export const LIGHT_MIN = 5;
export const SIZE_MAX = 20;
export const SIZE_MIN = 10;
/** Kształt jest losowany tylko dopóki siatka rośnie: inna liczba boków rzuca się w oczy nawet na 6×6. */
export const SHAPE_BOARDS = 8;
const SIZE = 80;
const SIDES_MAX = 8;

export type Move = QuizMove;

/** Wielokąt foremny: liczba boków, obrót w stopniach, barwa i jasność HSL, rozmiar w % pola symbolu. */
export type Symbol = { sides: number; angle: number; hue: number; light: number; size: number };

export interface State {
  players: PlayerId[];
  /** Plansza nr i (= liczba trafień): wszędzie `base`, na polu `odd` symbol `other`. */
  trials: { cols: number; rows: number; odd: number; base: Symbol; other: Symbol }[];
  results: Record<PlayerId, QuizResult>;
}

export type View = State;

const fade = (i: number, max: number, min: number) => Math.round(max - ((max - min) * Math.min(i, HARD)) / HARD);

// ponytail: wynik liczy klient jak w Kolorze liter, serwer odrzuca tylko nierealne wartości;
// lista dotknięć z czasami liczona na serwerze, gdyby ktoś zaczął oszukiwać.
export const inny: GameDefinition<State, Move> = {
  id: "inny",
  name: "Inny element",
  minPlayers: 1,
  maxPlayers: 6,
  // 30 s rundy + zapas na przeczytanie zasad i Start, jak w Kolorze liter.
  turnSeconds: 90,
  moveSchema: quizMoveSchema,

  setup: (players, rng) => ({
    players,
    trials: Array.from({ length: QUESTIONS }, (_, i) => {
      const int = (n: number) => Math.floor(rng() * n);
      const cols = Math.min(2 + Math.ceil(i / 2), MAX_SIDE);
      const rows = Math.min(2 + Math.floor(i / 2), MAX_SIDE);
      // 0 obrót, 1 odcień, 2 rozmiar, 3 kształt.
      const kind = int(i < SHAPE_BOARDS ? 4 : 3);
      const sign = rng() < 0.5 ? -1 : 1;
      // Obrót zawsze na trójkącie: im więcej boków, tym mniej widać, że figura jest obrócona.
      const sides = kind === 0 ? 3 : kind === 3 ? 3 + Math.floor(i / 3) : 3 + int(SIDES_MAX - 2);
      const base = { sides, angle: int(120), hue: int(360), light: 50 + int(11), size: SIZE };
      const other =
        kind === 0
          ? { ...base, angle: base.angle + sign * fade(i, ANGLE_MAX, ANGLE_MIN) }
          : kind === 1
            ? { ...base, light: base.light + sign * fade(i, LIGHT_MAX, LIGHT_MIN) }
            : kind === 2
              ? { ...base, size: SIZE + sign * fade(i, SIZE_MAX, SIZE_MIN) }
              : { ...base, sides: sides === 3 ? 4 : sides + sign };
      return { cols, rows, odd: int(cols * rows), base, other };
    }),
    results: {},
  }),

  validateMove: (state, player, move) => validQuiz(state, player, move),

  applyMove: (state, player, { times, errors }) => ({ ...state, results: { ...state.results, [player]: { times, errors } } }),

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, byHitsThenAverage),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", times: [], errors: 0 }),
};
