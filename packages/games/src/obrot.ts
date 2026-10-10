import { byScoreThenAverage, type GameDefinition, type PlayerId, ranked } from "./core.ts";
import { QUESTIONS, type QuizMove, quizMoveSchema, type QuizResult, validQuiz } from "./quiz.ts";

/** Klocków w figurze: od MIN na pierwszych parach, o jeden więcej co STEP par, do MAX. */
export const MIN_CELLS = 4;
export const MAX_CELLS = 7;
const STEP = 3;

export type Move = QuizMove;

/** Figura z klocków: pola `[x, y]` dosunięte do rogu (0, 0). */
export type Cells = [number, number][];

export interface State {
  players: PlayerId[];
  /** Para nr i: `b` to obrócona `a`, a przy `mirror` obrócone lustrzane odbicie `a`. */
  trials: { a: Cells; b: Cells; mirror: boolean }[];
  results: Record<PlayerId, QuizResult>;
}

export type View = State;

export const score = ({ times, errors }: QuizResult) => Math.max(0, times.length - errors);

/** Dosuwa figurę do rogu i sortuje pola: dwie takie same figury dają wtedy ten sam zapis. */
function norm(cells: Cells): Cells {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]): [number, number] => [x - minX, y - minY]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}
/** Obrót o `times` × 90°. */
const turn = (cells: Cells, times: number): Cells => (times ? turn(norm(cells.map(([x, y]) => [-y, x])), times - 1) : cells);
const flip = (cells: Cells) => norm(cells.map(([x, y]) => [-x, y]));
const same = (a: Cells, b: Cells) => String(a) === String(b);

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Losowa figura z `n` klocków, zawsze chiralna: jej odbicie nie jest żadnym z jej obrotów, więc pytanie ma jedną odpowiedź. */
function figure(n: number, int: (n: number) => number): Cells {
  for (;;) {
    const cells: Cells = [[0, 0]];
    while (cells.length < n) {
      const [x, y] = cells[int(cells.length)];
      const [dx, dy] = SIDES[int(4)];
      if (!cells.some(([cx, cy]) => cx === x + dx && cy === y + dy)) cells.push([x + dx, y + dy]);
    }
    const a = norm(cells);
    if (![0, 1, 2, 3].some((k) => same(turn(a, k), flip(a)))) return a;
  }
}

// ponytail: wynik liczy klient jak w Kolorze liter, serwer odrzuca tylko nierealne wartości;
// serwer zna `mirror`, więc mógłby liczyć sam z listy odpowiedzi, gdyby ktoś zaczął oszukiwać.
export const obrot: GameDefinition<State, Move> = {
  id: "obrot",
  name: "Obrót",
  minPlayers: 1,
  maxPlayers: 6,
  // 30 s rundy + zapas na przeczytanie zasad i Start, jak w Kolorze liter.
  turnSeconds: 90,
  moveSchema: quizMoveSchema,

  setup: (players, rng) => ({
    players,
    trials: Array.from({ length: QUESTIONS }, (_, i) => {
      const int = (n: number) => Math.floor(rng() * n);
      const a = figure(Math.min(MIN_CELLS + Math.floor(i / STEP), MAX_CELLS), int);
      const mirror = rng() < 0.5;
      const from = mirror ? flip(a) : a;
      // Figura, która po 180° wygląda tak samo, losuje kąt jeszcze raz: druga ma zawsze wyglądać inaczej niż przed obrotem.
      let b = from;
      while (same(b, from)) b = turn(from, 1 + int(3));
      return { a, b, mirror };
    }),
    results: {},
  }),

  validateMove: (state, player, move) => validQuiz(state, player, move),

  applyMove: (state, player, { times, errors }) => ({ ...state, results: { ...state.results, [player]: { times, errors } } }),

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, byScoreThenAverage(score)),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", times: [], errors: 0 }),
};
