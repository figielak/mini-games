import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults } from "./core.ts";

/** Współrzędne 0-1 względem kwadratowego płótna, więc rysunki wszystkich są w jednej skali. */
export type Point = [number, number];

export const MIN_POINTS = 20;
export const MAX_POINTS = 1000;
/** Mniejsze koło łatwiej narysować płynnie, więc nie liczy się. */
export const MIN_RADIUS = 0.15;
/** Część pełnego obrotu, od której rysunek uznajemy za koło. */
const MIN_TURN = 0.9;
/** Tyle obwodu przerwy między początkiem a końcem nie kosztuje (palec rzadko domyka idealnie). */
const GAP_FREE = 0.03;
/** Jak ostro kara rośnie z błędem promienia; do strojenia na rysunkach z telefonu. */
const STRICTNESS = 5;

/** Pusty rysunek = poddanie (0 pkt). */
export type Move = { type: "result"; points: Point[] };

export interface Result {
  /** 0-1000, dziesiąte części procenta. */
  score: number;
  /** Rysunek po obcięciu zakładki. */
  points: Point[];
}

export interface State {
  players: PlayerId[];
  /** Nic nie losuje, tylko odróżnia partie (rewanż montuje grę na kliencie od nowa). */
  nonce: number;
  results: Record<PlayerId, Result>;
}

export type View = State;

const TURN = 2 * Math.PI;

/** Zakreślony kąt wokół (cx, cy); zatrzymuje się po pełnym obrocie i zwraca, ile punktów do tego trzeba. */
function sweep(points: Point[], cx: number, cy: number) {
  let angle = 0;
  let prev = Math.atan2(points[0][1] - cy, points[0][0] - cx);
  for (let i = 1; i < points.length; i++) {
    const a = Math.atan2(points[i][1] - cy, points[i][0] - cx);
    let d = a - prev;
    if (d > Math.PI) d -= TURN;
    if (d < -Math.PI) d += TURN;
    angle += d;
    prev = a;
    if (Math.abs(angle) >= TURN) return { angle, end: i + 1 };
  }
  return { angle, end: points.length };
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Okrąg dopasowany metodą Kåsy: najmniejsze kwadraty dla x² + y² + Dx + Ey + F = 0. */
function fit(points: Point[]) {
  // Środek układu w średniej, żeby liczby w równaniach były małe.
  const mx = mean(points.map((p) => p[0]));
  const my = mean(points.map((p) => p[1]));
  let xx = 0, xy = 0, yy = 0, x = 0, y = 0, xz = 0, yz = 0, zs = 0;
  for (const [px, py] of points) {
    const u = px - mx;
    const v = py - my;
    const z = u * u + v * v;
    xx += u * u; xy += u * v; yy += v * v; x += u; y += v;
    xz += u * z; yz += v * z; zs += z;
  }
  const n = points.length;
  const det3 = (m: number[]) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  const det = det3([xx, xy, x, xy, yy, y, x, y, n]);
  const D = det3([-xz, xy, x, -yz, yy, y, -zs, y, n]) / det;
  const E = det3([xx, -xz, x, xy, -yz, y, x, -zs, n]) / det;
  const F = det3([xx, xy, -xz, xy, yy, -yz, x, y, -zs]) / det;
  return { cx: mx - D / 2, cy: my - E / 2, r: Math.sqrt((D * D + E * E) / 4 - F) };
}

/** Ocena rysunku; klient woła to samo przed wysłaniem, żeby niedokończone koło nie spaliło próby. */
export function judge(points: Point[]): Result & { status: "ok" | "unfinished" | "small" } {
  if (points.length < MIN_POINTS) return { status: "unfinished", score: 0, points };
  const cut = points.slice(0, sweep(points, mean(points.map((p) => p[0])), mean(points.map((p) => p[1]))).end);
  const { cx, cy, r } = fit(cut);
  if (!Number.isFinite(r) || r > 10 || Math.abs(sweep(cut, cx, cy).angle) < MIN_TURN * TURN) return { status: "unfinished", score: 0, points: cut };
  if (r < MIN_RADIUS) return { status: "small", score: 0, points: cut };
  const err = mean(cut.map(([px, py]) => Math.abs(Math.hypot(px - cx, py - cy) - r))) / r;
  const accuracy = Math.max(0, 1 - STRICTNESS * err) ** 2;
  const [first, last] = [cut[0], cut[cut.length - 1]];
  const gap = Math.max(0, Math.hypot(first[0] - last[0], first[1] - last[1]) / (TURN * r) - GAP_FREE);
  return { status: "ok", score: Math.round(1000 * accuracy * Math.max(0, 1 - gap)), points: cut };
}

const inCanvas = (v: number) => v >= 0 && v <= 1;

// ponytail: klient może wysłać okrąg wygenerowany kodem; między znajomymi wystarczy.
export const kolo: GameDefinition<State, Move> = {
  id: "kolo",
  name: "Narysuj koło",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 60,
  moveSchema: z.object({ type: z.literal("result"), points: z.array(z.tuple([z.number(), z.number()])).max(MAX_POINTS) }),

  setup: (players, rng) => ({ players, nonce: Math.floor(rng() * 2 ** 32), results: {} }),

  validateMove: (state, player, { points }) =>
    state.players.includes(player) &&
    !(player in state.results) &&
    (points.length === 0 || (points.length >= MIN_POINTS && points.length <= MAX_POINTS && points.every(([x, y]) => inCanvas(x) && inCanvas(y)))),

  applyMove: (state, player, { points }) => {
    const { score, points: cut } = judge(points);
    return { ...state, results: { ...state.results, [player]: { score, points: cut } } };
  },

  playerView: (state): View => state,

  isOver: (state) => rankResults(state.players, state.results, (a, b) => b.score - a.score),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", points: [] }),
};
