import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults } from "./core.ts";

export const CATEGORIES = ["Państwo", "Miasto", "Zwierzę", "Roślina", "Rzecz", "Imię"] as const;
/** Bez Ą Ę Ń Ó Ś Ź Ż Q V X Y: na nie prawie nic nie ma. */
export const LETTERS = "ABCDEFGHIJKLŁMNOPRSTUWZ";
export const ROUNDS = 5;
export const ANSWER_MAX = 30;

export type Cell = { player: PlayerId; category: number };

export type Move =
  | { type: "write"; answers: string[]; done: boolean }
  | { type: "vote"; rejected: Cell[] }
  | { type: "next" };

export type Phase = "write" | "vote" | "summary" | "over";

export interface State {
  players: PlayerId[];
  letters: string[];
  round: number;
  phase: Phase;
  /** Odpowiedzi rundy (w pisaniu: szkice). */
  answers: Record<PlayerId, string[]>;
  /** Kto skończył pisać. */
  done: PlayerId[];
  /** Kto pierwszy oddał kartkę (STOP) w tej rundzie pisania. */
  stop: PlayerId | null;
  votes: Record<PlayerId, Cell[]>;
  /** Kto kliknął „Dalej” po podsumowaniu. */
  ready: PlayerId[];
  /** Punkty ostatniej rundy, po kategorii. */
  roundScores: Record<PlayerId, number[]>;
  totals: Record<PlayerId, number>;
}

export type View = State;

const SECONDS = { write: 90, stop: 7, vote: 45, summary: 20 };
const EMPTY = CATEGORIES.map(() => "");

/** Porównanie duplikatów: bez wielkości liter, polskich znaków i nadmiarowych spacji. */
export const normalize = (answer: string) =>
  answer.trim().toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ");

/** Niepusta i na właściwą literę (Ł to inna litera niż L). */
export const fits = (letter: string, answer: string) => answer.trim().slice(0, 1).toLocaleUpperCase("pl") === letter;

function score(state: State): Record<PlayerId, number[]> {
  const { players, answers, votes } = state;
  const letter = state.letters[state.round];
  const flags = (p: PlayerId, c: number) => players.filter((v) => votes[v].some((x) => x.player === p && x.category === c)).length;
  const valid = (p: PlayerId, c: number) => fits(letter, answers[p][c]) && flags(p, c) <= (players.length - 1) / 2;
  const scores = Object.fromEntries(players.map((p) => [p, CATEGORIES.map(() => 0)]));
  CATEGORIES.forEach((_, c) => {
    const ok = players.filter((p) => valid(p, c));
    for (const p of ok) {
      const same = ok.filter((q) => normalize(answers[q][c]) === normalize(answers[p][c])).length;
      scores[p][c] = ok.length === 1 ? 15 : same > 1 ? 5 : 10;
    }
  });
  return scores;
}

function newRound(state: State, round: number): State {
  return { ...state, round, phase: "write", answers: {}, done: [], stop: null, votes: {}, ready: [] };
}

export const panstwaMiasta: GameDefinition<State, Move> = {
  id: "panstwa-miasta",
  name: "Państwa-miasta",
  minPlayers: 2,
  maxPlayers: 6,
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("write"), answers: z.array(z.string().max(ANSWER_MAX)).length(CATEGORIES.length), done: z.boolean() }),
    z.object({
      type: z.literal("vote"),
      rejected: z.array(z.object({ player: z.string(), category: z.number().int() })).max(CATEGORIES.length * 6),
    }),
    z.object({ type: z.literal("next") }),
  ]),

  setup: (players, rng) => {
    const pool = [...LETTERS];
    const letters = Array.from({ length: ROUNDS }, () => pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    const totals = Object.fromEntries(players.map((p) => [p, 0]));
    return newRound({ players, letters, totals, roundScores: {} } as unknown as State, 0);
  },

  validateMove: (state, player, move) => {
    if (!state.players.includes(player)) return false;
    switch (move.type) {
      case "write":
        return state.phase === "write" && !state.done.includes(player);
      case "vote":
        return (
          state.phase === "vote" &&
          !(player in state.votes) &&
          move.rejected.every((c) => c.player !== player && state.players.includes(c.player) && c.category >= 0 && c.category < CATEGORIES.length)
        );
      case "next":
        return state.phase === "summary" && !state.ready.includes(player);
    }
  },

  applyMove: (state, player, move) => {
    switch (move.type) {
      case "write": {
        const s = { ...state, answers: { ...state.answers, [player]: move.answers } };
        if (!move.done) return s;
        s.done = [...s.done, player];
        s.stop ??= player;
        // Kto nic nie wysłał, nie ma też wpisu w answers.
        if (s.done.length === s.players.length) return { ...s, phase: "vote", stop: null };
        return s;
      }
      case "vote": {
        const s = { ...state, votes: { ...state.votes, [player]: move.rejected } };
        if (Object.keys(s.votes).length < s.players.length) return s;
        const roundScores = score(s);
        const totals = Object.fromEntries(s.players.map((p) => [p, s.totals[p] + roundScores[p].reduce((a, b) => a + b, 0)]));
        return { ...s, roundScores, totals, phase: s.round === ROUNDS - 1 ? "over" : "summary" };
      }
      case "next": {
        const ready = [...state.ready, player];
        return ready.length === state.players.length ? newRound(state, state.round + 1) : { ...state, ready };
      }
    }
  },

  // W pisaniu każdy widzi tylko swój szkic, w głosowaniu tylko swój głos; potem wszystko jest jawne.
  playerView: (state, player): View => {
    const own = <T>(rec: Record<PlayerId, T>) => (player in rec ? { [player]: rec[player] } : {});
    if (state.phase === "write") return { ...state, answers: own(state.answers) };
    if (state.phase === "vote") return { ...state, votes: own(state.votes) };
    return state;
  },

  isOver: (state) => (state.phase === "over" ? rankResults(state.players, state.totals, (a, b) => b - a) : null),

  waitingFor: (state) => {
    const not = (list: PlayerId[]) => state.players.filter((p) => !list.includes(p));
    if (state.phase === "write") return not(state.done);
    if (state.phase === "vote") return not(Object.keys(state.votes));
    if (state.phase === "summary") return not(state.ready);
    return [];
  },

  turn: (state) => ({
    key: `${state.phase}:${state.round}:${state.stop ?? ""}`,
    seconds: state.phase === "write" ? (state.stop ? SECONDS.stop : SECONDS.write) : state.phase === "over" ? 0 : SECONDS[state.phase],
  }),

  timeoutMove: (state, player) => {
    if (state.phase === "write") return { type: "write", answers: state.answers[player] ?? EMPTY, done: true };
    if (state.phase === "vote") return { type: "vote", rejected: [] };
    return { type: "next" };
  },
};
