import { z } from "zod";
import { type GameDefinition, type PlayerId, ranked, shuffle } from "./core.ts";
import { CITIES } from "./mapa-dane.ts";

export const ROUNDS = 10;
/** Pole gry: prostokąt geograficzny w stopniach, kontur Polski z marginesem. */
export const BOUNDS = { west: 13.9, east: 24.3, south: 48.9, north: 54.95 };
/** Kara za rundę po limicie czasu w km; więcej niż przekątna pola, czyli niż najgorsza uczciwa runda. */
export const MAX_ERROR = 1000;
const EARTH_KM = 6371;

const rad = (deg: number) => (deg * Math.PI) / 180;

// ponytail: odwzorowanie walcowe równoodległościowe (stopnie liniowo na x i y), rysunek zniekształcony do ok. 6% na północy i południu;
// wynik liczy się z lat/lon, więc to tylko wygląd. Przy Europie trzeba prawdziwego odwzorowania.
/** Szerokość pola do wysokości: stopień długości na 52°N jest krótszy niż stopień szerokości. */
export const ASPECT = ((BOUNDS.east - BOUNDS.west) * Math.cos(rad(52))) / (BOUNDS.north - BOUNDS.south);

/** Pozycja na polu, 0-1 w obu osiach; (0, 0) to róg północno-zachodni. */
export type Point = { x: number; y: number };
export type Place = { lat: number; lon: number };
export type City = Place & { name: string };

/** Pusta lista = limit czasu (MAX_ERROR za każdą rundę). */
export type Move = { type: "result"; taps: Point[] };

export interface State {
  players: PlayerId[];
  cities: City[];
  /** Suma odległości w km (int). */
  results: Record<PlayerId, number>;
  taps: Record<PlayerId, Point[]>;
}

export type View = State;

export const place = ({ lat, lon }: Place): Point => ({
  x: (lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west),
  y: (BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south),
});

export const locate = ({ x, y }: Point): Place => ({
  lat: BOUNDS.north - y * (BOUNDS.north - BOUNDS.south),
  lon: BOUNDS.west + x * (BOUNDS.east - BOUNDS.west),
});

/** Odległość po ortodromie w km (haversine). */
export function distance(a: Place, b: Place): number {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Błąd rundy: odległość wskazanego punktu od miasta w pełnych km. */
export const error = (city: Place, tap: Point): number => Math.round(distance(city, locate(tap)));

// NaN i nieskończoność też tu odpadają: porównanie z NaN jest fałszywe.
const inField = (v: number) => v >= 0 && v <= 1;

// ponytail: miasta ze współrzędnymi są w widoku od startu (ekran pokazuje je w odsłonie), da się podejrzeć; między znajomymi wystarczy.
export const mapa: GameDefinition<State, Move> = {
  id: "mapa",
  name: "Mapa",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 180,
  moveSchema: z.object({
    type: z.literal("result"),
    taps: z.array(z.object({ x: z.number(), y: z.number() })).max(ROUNDS),
  }),

  setup: (players, rng) => ({
    players,
    cities: shuffle(CITIES, rng).slice(0, ROUNDS).map(([name, lat, lon]) => ({ name, lat, lon })),
    results: {},
    taps: {},
  }),

  validateMove: (state, player, { taps }) =>
    state.players.includes(player) && !(player in state.results) && (taps.length === 0 || (taps.length === ROUNDS && taps.every((t) => inField(t.x) && inField(t.y)))),

  applyMove: (state, player, { taps }) => ({
    ...state,
    results: { ...state.results, [player]: taps.length ? state.cities.reduce((sum, city, i) => sum + error(city, taps[i]), 0) : ROUNDS * MAX_ERROR },
    taps: { ...state.taps, [player]: taps },
  }),

  playerView: (state): View => state,

  ...ranked((state: State) => state.results, (a, b) => a - b),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", taps: [] }),
};
