import { type PlayerId, type Rng, shuffle } from "./core.ts";

/** Klucz rankingu w SQLite. Turniej nie jest grą z rejestru GAMES: to seria mini-gier prowadzona przez pokój. */
export const TOURNAMENT_ID = "turniej";
export const MIN_LENGTH = 3;
export const DEFAULT_LENGTH = 8;
/** Tyle widać wyniki gry i tabelę, zanim następna gra ruszy sama. */
export const NEXT_SECONDS = 15;

/** Ustawienia turnieju: liczba gier (gospodarz), gry, które będą na pewno, i gry wykluczone (zaznacza każdy). Resztę losuje serwer. */
export interface Config {
  length: number;
  must: string[];
  skip: string[];
}

export interface Tournament {
  config: Config;
  /** Wylosowane gry w kolejności rozgrywania; puste przed startem. Dogrywka dopisuje jedną na końcu. */
  games: string[];
  /** Ile gier już rozegrano. */
  index: number;
  /** Punkty graczy za kolejne rozegrane gry; gra przerwana to pusty wpis. */
  points: Record<PlayerId, number>[];
  /** Dogrywka została już dolosowana (jest najwyżej jedna). */
  extra: boolean;
}

export interface Standing {
  id: PlayerId;
  total: number;
  /** Punkty za ostatnią rozegraną grę. */
  last: number;
  /** Wygrane gry: samodzielne pierwsze miejsce przy 2+ graczach. */
  wins: number;
}

/** Sprawdza ustawienia z sieci względem puli mini-gier. Długość przycina do zakresu, resztę błędów odrzuca (null). */
export function cleanConfig(raw: Config, pool: string[]): Config | null {
  if (!Number.isInteger(raw.length)) return null;
  if (![...raw.must, ...raw.skip].every((id) => pool.includes(id))) return null;
  const must = pool.filter((id) => raw.must.includes(id));
  const skip = pool.filter((id) => raw.skip.includes(id));
  if (must.some((id) => skip.includes(id))) return null;
  const available = pool.length - skip.length;
  if (available < MIN_LENGTH) return null;
  return { length: Math.max(MIN_LENGTH, must.length, Math.min(raw.length, available)), must, skip };
}

export type Mark = "must" | "skip" | "any";

/** Zaznaczenie jednej gry (na pewno, bez albo z powrotem losowo); ostatnie zaznaczenie wygrywa. Null, gdy się nie da. */
export function mark(config: Config, id: string, state: Mark, pool: string[]): Config | null {
  if (!pool.includes(id)) return null;
  const list = (ids: string[], on: boolean) => [...ids.filter((g) => g !== id), ...(on ? [id] : [])];
  return cleanConfig({ length: config.length, must: list(config.must, state === "must"), skip: list(config.skip, state === "skip") }, pool);
}

export const create = (config: Config): Tournament => ({ config, games: [], index: 0, points: [], extra: false });

/** Gry turnieju: wszystkie „na pewno” i losowe z reszty puli, w potasowanej kolejności. */
export function draw({ length, must, skip }: Config, pool: string[], rng: Rng): string[] {
  const rest = pool.filter((id) => !must.includes(id) && !skip.includes(id));
  return shuffle([...must, ...shuffle(rest, rng).slice(0, length - must.length)], rng);
}

/** Start (i rewanż): nowe losowanie, tabela od zera. */
export const begin = (t: Tournament, pool: string[], rng: Rng): Tournament => ({ ...create(t.config), games: draw(t.config, pool, rng) });

/** Punkty za grę: liczba graczy ze ściśle gorszym miejscem. */
export function gamePoints(places: Record<PlayerId, number>, players: PlayerId[]): Record<PlayerId, number> {
  return Object.fromEntries(players.map((p) => [p, players.filter((q) => places[q] > places[p]).length]));
}

/** Tabela graczy, którzy wciąż grają: suma punktów, potem wygrane gry; przy pełnym remisie kolejność miejsc. */
export function standings(t: Tournament, players: PlayerId[]): Standing[] {
  const rows = players.map((id) => ({
    id,
    total: t.points.reduce((sum, game) => sum + (game[id] ?? 0), 0),
    last: t.points.at(-1)?.[id] ?? 0,
    // Zwycięzca gry pokonał wszystkich, którzy w niej grali.
    wins: t.points.filter((game) => Object.keys(game).length > 1 && game[id] === Object.keys(game).length - 1).length,
  }));
  return rows.sort(byStanding);
}

const byStanding = (a: Standing, b: Standing) => b.total - a.total || b.wins - a.wins;

export const isDone = (t: Tournament) => t.games.length > 0 && t.index >= t.games.length;

/** Zwycięzca skończonego turnieju: samodzielny lider tabeli. Solo i remis na szczycie nie dają zwycięzcy. */
export function winner(t: Tournament, players: PlayerId[]): PlayerId | undefined {
  const [first, second] = standings(t, players);
  return isDone(t) && second && byStanding(first, second) < 0 ? first.id : undefined;
}

/**
 * Zapisuje wynik bieżącej gry (`places` z mini-gry albo null, gdy gra została przerwana) i przechodzi do następnej.
 * Remis na szczycie po ostatniej grze dolosowuje jedną dogrywkę.
 */
export function advance(t: Tournament, players: PlayerId[], places: Record<PlayerId, number> | null, pool: string[], rng: Rng): Tournament {
  const next = { ...t, index: t.index + 1, points: [...t.points, places ? gamePoints(places, players) : {}] };
  if (!isDone(next) || next.extra || players.length < 2 || winner(next, players)) return next;
  const allowed = pool.filter((id) => !t.config.skip.includes(id));
  const fresh = allowed.filter((id) => !t.games.includes(id));
  const from = fresh.length ? fresh : allowed;
  return { ...next, games: [...next.games, from[Math.floor(rng() * from.length)]], extra: true };
}
