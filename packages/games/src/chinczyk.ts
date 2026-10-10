import { z } from "zod";
import type { GameDefinition, PlayerId, Rng } from "./core.ts";

export const TRACK = 40;
/** Ostatnia pozycja: 40-43 to domek końcowy. */
const LAST = TRACK + 3;
const BASE = -1;

interface Rules {
  id: string;
  name: string;
  hint: string;
  default?: boolean;
  /** Oczka, które wyprowadzają pionek z domku startowego. */
  exits: number[];
  /** Ile pionków zaczyna na polu startowym. */
  onTrack: number;
  /** Do domku końcowego tylko dokładnym rzutem i bez przeskakiwania własnych pionków; inaczej nadwyżka oczek przepada. */
  exact: boolean;
  /** Dodatkowy rzut za zbicie i za wejście pionka do domku końcowego. */
  bonus: boolean;
  /** Ile pionków w domku końcowym kończy grę gracza. */
  goal: number;
  /** Gra do pełnego rankingu; inaczej partię kończy pierwszy gracz u celu. */
  untilRanking: boolean;
  seconds: number;
}

/** Tryby do wyboru w lobby. */
export const MODES: Rules[] = [
  { id: "klasyczny", name: "Klasyczny", hint: "Wyjście na 6, do domku dokładnym rzutem, 4 pionki", exits: [6], onTrack: 0, exact: true, bonus: false, goal: 4, untilRanking: true, seconds: 60, default: true },
  { id: "szybki", name: "Szybki", hint: "Pionek na starcie, wyjście na 1 i 6, wygrywają 3 pionki", exits: [1, 6], onTrack: 1, exact: false, bonus: true, goal: 3, untilRanking: false, seconds: 20 },
];
const DEFAULT = MODES.find((m) => m.default)!;

export type Move = { type: "roll" } | { type: "move"; pawn: number };

/** Ostatni rzut i jego skutek: klient animuje kostkę i pionek oraz pokazuje komunikat. */
export interface Last {
  /** Numer rzutu w partii; zmiana oznacza nowy rzut (także z tym samym wynikiem). */
  roll: number;
  player: PlayerId;
  dice: number;
  /** Ruch po rzucie; brak, dopóki gracz wybiera pionek. */
  move?: { pawn: number; from: number; to: number; captured: PlayerId[] };
  /** Rzut bez ruchu: trzecia szóstka z rzędu albo brak możliwego ruchu. */
  note?: "sixes" | "none";
}

export interface State {
  /** Id trybu z MODES. */
  mode: string;
  players: PlayerId[];
  /** Pole toru, z którego startuje gracz. */
  starts: Record<PlayerId, number>;
  /** Pozycje liczone od własnego startu: -1 domek startowy, 0-39 tor, 40-43 domek końcowy. */
  pawns: Record<PlayerId, number[]>;
  turn: number;
  phase: "roll" | "move" | "over";
  dice: number | null;
  /** Szóstki z rzędu w tej turze. */
  sixes: number;
  /** Próby, gdy żaden pionek nie stoi na torze. */
  tries: number;
  ranking: PlayerId[];
  last: Last | null;
}

export type View = Omit<State, "turn" | "sixes"> & {
  turn: PlayerId | null;
  /** Pionki gracza na turze, którymi można się teraz ruszyć. */
  movable: number[];
  /** Cel każdego z tych pionków (pionek → pozycja). */
  targets: Record<number, number>;
};

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll") }),
  z.object({ type: z.literal("move"), pawn: z.number().int().min(0).max(3) }),
]);

const rules = (s: Pick<State, "mode">) => MODES.find((m) => m.id === s.mode) ?? DEFAULT;
const current = (s: State) => s.players[s.turn];
/** Pole na wspólnym torze dla pozycji 0-39 danego gracza. */
const square = (s: State, player: PlayerId, pos: number) => (s.starts[player] + pos) % TRACK;
const onTrack = (pos: number) => pos >= 0 && pos < TRACK;

function target(s: State, player: PlayerId, pawn: number, dice: number): number | null {
  const { exits, exact } = rules(s);
  const own = s.pawns[player];
  const pos = own[pawn];
  if (pos === BASE) return exits.includes(dice) ? 0 : null;
  const next = pos + dice;
  if (exact) {
    if (next > LAST) return null;
    // W domku końcowym nie wolno przeskoczyć własnego pionka.
    for (let p = Math.max(pos + 1, TRACK); p < next; p++) if (own.includes(p)) return null;
    return next;
  }
  if (next <= LAST) return next;
  // Nadwyżka oczek przepada: najdalsze wolne pole domku końcowego przed pionkiem.
  for (let p = LAST; p > pos && p >= TRACK; p--) if (!own.includes(p)) return p;
  return null;
}

/** Pionki, którymi gracz może ruszyć przy danym rzucie. Pionki w domku startowym są nierozróżnialne: liczy się pierwszy. */
function movablePawns(s: State, player: PlayerId, dice: number): number[] {
  const own = s.pawns[player];
  const firstInBase = own.indexOf(BASE);
  // Pole startowe rywala, na którym stoi jego pionek, jest bezpieczne.
  const guarded = (to: number) =>
    onTrack(to) && s.players.some((other) => other !== player && s.pawns[other].includes(0) && s.starts[other] === square(s, player, to));
  return own.flatMap((pos, i) => {
    if (pos === BASE && i !== firstInBase) return [];
    const to = target(s, player, i, dice);
    // Na własny pionek wejść nie można; wszyscy liczą pozycje od tego samego, własnego startu.
    return to !== null && !own.some((p, j) => j !== i && p === to) && !guarded(to) ? [i] : [];
  });
}

export function legalMoves(s: State): number[] {
  return s.phase === "move" && s.dice !== null ? movablePawns(s, current(s), s.dice) : [];
}

/** Tura przechodzi na następnego gracza, który jeszcze nie skończył. */
function endTurn(s: State): State {
  let turn = s.turn;
  do turn = (turn + 1) % s.players.length;
  while (s.ranking.includes(s.players[turn]));
  return { ...s, turn, phase: "roll", sixes: 0, tries: 3 };
}

function movePawn(s: State, player: PlayerId, pawn: number): State {
  const { bonus, goal, untilRanking } = rules(s);
  const to = target(s, player, pawn, s.dice!)!;
  const from = s.pawns[player][pawn];
  const pawns: State["pawns"] = { ...s.pawns, [player]: s.pawns[player].map((p, i) => (i === pawn ? to : p)) };
  const captured: PlayerId[] = [];

  // Zbicie: pionek przeciwnika na tym samym polu toru wraca do domku startowego.
  if (onTrack(to)) {
    const at = square(s, player, to);
    for (const other of s.players) {
      if (other === player) continue;
      const hit = (p: number) => onTrack(p) && square(s, other, p) === at;
      if (pawns[other].some(hit)) captured.push(other);
      pawns[other] = pawns[other].map((p) => (hit(p) ? BASE : p));
    }
  }

  const next: State = { ...s, pawns, last: { ...s.last!, move: { pawn, from, to, captured } } };
  const home = (p: PlayerId) => pawns[p].filter((pos) => pos >= TRACK).length;
  if (home(player) >= goal) {
    if (!untilRanking) {
      // Partia kończy się od razu; reszta według pionków w domku końcowym, potem sumy pozycji.
      const sum = (p: PlayerId) => pawns[p].reduce((a, b) => a + b, 0);
      const rest = s.players.filter((p) => p !== player).sort((a, b) => home(b) - home(a) || sum(b) - sum(a));
      return { ...next, ranking: [player, ...rest], phase: "over" };
    }
    const ranking = [...s.ranking, player];
    const left = s.players.filter((p) => !ranking.includes(p));
    if (left.length <= 1) return { ...next, ranking: [...ranking, ...left], phase: "over" };
    return endTurn({ ...next, ranking });
  }
  // Szóstka (a w trybie z premią także zbicie i wejście do domku końcowego): kolejny rzut tego samego gracza.
  const again = s.dice === 6 || (bonus && (captured.length > 0 || (from < TRACK && to >= TRACK)));
  return again ? { ...next, phase: "roll" } : endTurn(next);
}

export const chinczyk: GameDefinition<State, Move> = {
  id: "chinczyk",
  name: "Chińczyk",
  minPlayers: 2,
  maxPlayers: 4,
  moveSchema,
  modes: MODES,

  setup(players, _rng, modeId) {
    const mode = MODES.find((m) => m.id === modeId) ?? DEFAULT;
    // Przy dwóch graczach siedzą naprzeciw siebie.
    const step = players.length === 2 ? TRACK / 2 : TRACK / 4;
    return {
      mode: mode.id,
      players,
      starts: Object.fromEntries(players.map((p, i) => [p, i * step])),
      pawns: Object.fromEntries(players.map((p) => [p, [0, 1, 2, 3].map((i) => (i < mode.onTrack ? 0 : BASE))])),
      turn: 0,
      phase: "roll",
      dice: null,
      sixes: 0,
      tries: 3,
      ranking: [],
      last: null,
    };
  },

  validateMove(s, player, move) {
    if (s.phase === "over" || current(s) !== player) return false;
    if (move.type === "roll") return s.phase === "roll";
    return legalMoves(s).includes(move.pawn);
  },

  applyMove(s, player, move, rng: Rng) {
    if (move.type === "move") return movePawn(s, player, move.pawn);

    const dice = Math.floor(rng() * 6) + 1;
    const sixes = dice === 6 ? s.sixes + 1 : 0;
    const last: Last = { roll: (s.last?.roll ?? 0) + 1, player, dice };
    const rolled: State = { ...s, dice, sixes, last };
    const none = { ...rolled, last: { ...last, note: "none" as const } };
    if (sixes === 3) return endTurn({ ...rolled, last: { ...last, note: "sixes" } });

    const options = movablePawns(rolled, player, dice);
    if (options.length === 1) return movePawn(rolled, player, options[0]);
    if (options.length > 1) return { ...rolled, phase: "move" };

    // Brak ruchu: szóstka i tak daje kolejny rzut; bez pionków na torze są 3 próby.
    if (dice === 6) return { ...none, phase: "roll" };
    if (!s.pawns[player].some(onTrack) && s.tries > 1) return { ...none, tries: s.tries - 1 };
    return endTurn(none);
  },

  playerView: (s): View => ({
    mode: rules(s).id,
    players: s.players,
    starts: s.starts,
    pawns: s.pawns,
    turn: s.phase === "over" ? null : current(s),
    phase: s.phase,
    dice: s.dice,
    ranking: s.ranking,
    tries: s.tries,
    last: s.last,
    movable: legalMoves(s),
    targets: Object.fromEntries(legalMoves(s).map((i) => [i, target(s, current(s), i, s.dice!)!])),
  }),

  isOver: (s) => (s.phase === "over" ? { winner: s.ranking[0], ranking: s.ranking } : null),

  // Limit od nowa po każdym rzucie i ruchu; klient woła to samo na widoku (liczy się tylko `seconds`).
  turn: (s) => ({ key: `${s.turn}:${s.phase}:${s.last?.roll ?? 0}`, seconds: rules(s).seconds }),

  waitingFor: (s) => (s.phase === "over" ? [] : [current(s)]),

  timeoutMove(s, _player, rng) {
    if (s.phase === "roll") return { type: "roll" };
    const options = legalMoves(s);
    return { type: "move", pawn: options[Math.floor(rng() * options.length)] };
  },
};
