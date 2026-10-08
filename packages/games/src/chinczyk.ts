import { z } from "zod";
import type { GameDefinition, PlayerId, Rng } from "./core.ts";

export const TRACK = 40;
/** Ostatnia pozycja: 40-43 to domek końcowy. */
const LAST = TRACK + 3;
const BASE = -1;

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
};

const moveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll") }),
  z.object({ type: z.literal("move"), pawn: z.number().int().min(0).max(3) }),
]);

const current = (s: State) => s.players[s.turn];
/** Pole na wspólnym torze dla pozycji 0-39 danego gracza. */
const square = (s: State, player: PlayerId, pos: number) => (s.starts[player] + pos) % TRACK;
const onTrack = (pos: number) => pos >= 0 && pos < TRACK;

function target(pos: number, dice: number): number | null {
  if (pos === BASE) return dice === 6 ? 0 : null;
  const next = pos + dice;
  return next <= LAST ? next : null;
}

/** Pionki, którymi gracz może ruszyć przy danym rzucie. Pionki w domku startowym są nierozróżnialne: liczy się pierwszy. */
function movablePawns(s: State, player: PlayerId, dice: number): number[] {
  const own = s.pawns[player];
  const firstInBase = own.indexOf(BASE);
  return own.flatMap((pos, i) => {
    if (pos === BASE && i !== firstInBase) return [];
    const to = target(pos, dice);
    // Na własny pionek wejść nie można; wszyscy liczą pozycje od tego samego, własnego startu.
    return to !== null && !own.some((p, j) => j !== i && p === to) ? [i] : [];
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
  const to = target(s.pawns[player][pawn], s.dice!)!;
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
  if (pawns[player].every((p) => p >= TRACK)) {
    const ranking = [...s.ranking, player];
    const left = s.players.filter((p) => !ranking.includes(p));
    if (left.length <= 1) return { ...next, ranking: [...ranking, ...left], phase: "over" };
    return endTurn({ ...next, ranking });
  }
  // Szóstka: kolejny rzut tego samego gracza.
  return s.dice === 6 ? { ...next, phase: "roll" } : endTurn(next);
}

export const chinczyk: GameDefinition<State, Move> = {
  id: "chinczyk",
  name: "Chińczyk",
  minPlayers: 2,
  maxPlayers: 4,
  turnSeconds: 60,
  moveSchema,

  setup(players) {
    // Przy dwóch graczach siedzą naprzeciw siebie.
    const step = players.length === 2 ? TRACK / 2 : TRACK / 4;
    return {
      players,
      starts: Object.fromEntries(players.map((p, i) => [p, i * step])),
      pawns: Object.fromEntries(players.map((p) => [p, [BASE, BASE, BASE, BASE]])),
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
  }),

  isOver: (s) => (s.phase === "over" ? { winner: s.ranking[0], ranking: s.ranking } : null),

  waitingFor: (s) => (s.phase === "over" ? [] : [current(s)]),

  timeoutMove(s, _player, rng) {
    if (s.phase === "roll") return { type: "roll" };
    const options = legalMoves(s);
    return { type: "move", pawn: options[Math.floor(rng() * options.length)] };
  },
};
