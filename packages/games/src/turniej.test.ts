import { describe, expect, test } from "vitest";
import { createRng, GAMES } from "./index.ts";
import { advance, begin, cleanConfig, create, DEFAULT_LENGTH, draw, gamePoints, isDone, MIN_LENGTH, standings, TOURNAMENT_ID, type Tournament, winner } from "./turniej.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - turniej to seria mini-gier, nie gra z rejestru; `id` "turniej" służy tylko rankingowi,
// - konfiguracja: liczba gier (3 do liczby niewykluczonych, przycinana), gry „na pewno” (podnoszą długość) i wykluczone,
// - losowanie: wszystkie „na pewno” i losowe z reszty, bez powtórzeń i bez wykluczonych,
// - punkty za grę: liczba graczy ze ściśle gorszym miejscem; gra przerwana daje wszystkim 0,
// - tabela: suma punktów, potem wygrane gry (samodzielne 1. miejsce przy 2+ graczach),
// - koniec po ostatniej grze; remis na szczycie daje jedną dogrywkę, po niej remis zostaje bez zwycięzcy,
// - gracz, który wyszedł, znika z tabeli; turniej solo nie ma zwycięzcy ani dogrywki.

const A = "ania";
const B = "bartek";
const C = "celina";
const POOL = ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8", "g9", "g10"];
const config = (length: number, must: string[] = [], skip: string[] = []) => ({ length, must, skip });
/** Turniej po starcie z podaną listą gier. */
const started = (games: string[], cfg = config(games.length)): Tournament => ({ ...create(cfg), games });
/** Rozgrywa kolejne gry z podanymi miejscami (null = gra przerwana). */
const play = (t: Tournament, players: string[], ...rounds: (Record<string, number> | null)[]) =>
  rounds.reduce((s, places, i) => advance(s, players, places, POOL, createRng(i + 1)), t);

test("turniej nie jest grą z rejestru", () => {
  expect(TOURNAMENT_ID).toBe("turniej");
  expect(GAMES[TOURNAMENT_ID]).toBeUndefined();
});

describe("konfiguracja", () => {
  test("poprawna konfiguracja przechodzi bez zmian", () => {
    expect(cleanConfig(config(5, ["g2"], ["g9"]), POOL)).toEqual(config(5, ["g2"], ["g9"]));
    expect(cleanConfig(config(DEFAULT_LENGTH), POOL)).toEqual(config(8));
  });

  test("długość jest przycinana do zakresu: od 3 do liczby niewykluczonych gier", () => {
    expect(MIN_LENGTH).toBe(3);
    expect(cleanConfig(config(1), POOL)!.length).toBe(3);
    expect(cleanConfig(config(-5), POOL)!.length).toBe(3);
    expect(cleanConfig(config(10), POOL)!.length).toBe(10);
    expect(cleanConfig(config(99), POOL)!.length).toBe(10);
    expect(cleanConfig(config(9, [], ["g1", "g2", "g3"]), POOL)!.length).toBe(7);
  });

  test("więcej gier „na pewno” niż długość podnosi długość", () => {
    expect(cleanConfig(config(3, ["g1", "g2", "g3", "g4", "g5"]), POOL)!.length).toBe(5);
  });

  test("listy bez powtórzeń, w kolejności puli", () => {
    expect(cleanConfig(config(5, ["g4", "g2", "g4"], ["g9", "g7", "g9"]), POOL)).toEqual(config(5, ["g2", "g4"], ["g7", "g9"]));
  });

  test("odrzucona: nieznana gra, gra na obu listach, niecałkowita długość, za mało gier po wykluczeniu", () => {
    expect(cleanConfig(config(5, ["nie-ma"]), POOL)).toBeNull();
    expect(cleanConfig(config(5, [], ["constructor"]), POOL)).toBeNull();
    expect(cleanConfig(config(5, ["g1"], ["g1"]), POOL)).toBeNull();
    expect(cleanConfig(config(4.5), POOL)).toBeNull();
    expect(cleanConfig(config(Number.NaN), POOL)).toBeNull();
    expect(cleanConfig(config(3, [], POOL.slice(0, 8)), POOL)).toBeNull();
    expect(cleanConfig(config(3, [], POOL.slice(0, 7)), POOL)).toEqual(config(3, [], POOL.slice(0, 7)));
  });
});

describe("losowanie", () => {
  test("tyle gier, ile w konfiguracji, bez powtórzeń, z puli", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const games = draw(config(6), POOL, createRng(seed));
      expect(games).toHaveLength(6);
      expect(new Set(games).size).toBe(6);
      for (const g of games) expect(POOL).toContain(g);
    }
  });

  test("gry „na pewno” są zawsze, wykluczonych nie ma nigdy", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const games = draw(config(4, ["g3", "g8"], ["g1", "g2", "g5"]), POOL, createRng(seed));
      expect(games).toHaveLength(4);
      expect(games).toEqual(expect.arrayContaining(["g3", "g8"]));
      for (const g of ["g1", "g2", "g5"]) expect(games).not.toContain(g);
    }
  });

  test("gry „na pewno” nie stoją zawsze na początku", () => {
    const firsts = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => draw(config(5, ["g1"]), POOL, createRng(seed))[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });

  test("ten sam seed to samo losowanie, różne seedy różne", () => {
    expect(draw(config(6), POOL, createRng(7))).toEqual(draw(config(6), POOL, createRng(7)));
    const draws = new Set([1, 2, 3, 4, 5].map((seed) => draw(config(6), POOL, createRng(seed)).join()));
    expect(draws.size).toBeGreaterThan(1);
  });

  test("start: lista gier, nic nie rozegrano; rewanż zeruje poprzedni turniej", () => {
    const t = begin(create(config(3)), POOL, createRng(1));
    expect(t.games).toHaveLength(3);
    expect(t.index).toBe(0);
    expect(isDone(t)).toBe(false);
    const again = begin(play(t, [A, B], { [A]: 1, [B]: 2 }), POOL, createRng(2));
    expect(again.index).toBe(0);
    expect(again.points).toEqual([]);
    expect(again.extra).toBe(false);
  });

  test("przed startem turniej nie jest skończony", () => {
    expect(isDone(create(config(3)))).toBe(false);
  });
});

describe("punkty za grę", () => {
  test("liczba graczy ze ściśle gorszym miejscem", () => {
    expect(gamePoints({ [A]: 1, [B]: 2, [C]: 3 }, [A, B, C])).toEqual({ [A]: 2, [B]: 1, [C]: 0 });
  });

  test("remisujący dostają tyle samo", () => {
    expect(gamePoints({ [A]: 1, [B]: 1, [C]: 3 }, [A, B, C])).toEqual({ [A]: 1, [B]: 1, [C]: 0 });
    expect(gamePoints({ [A]: 1, [B]: 2, [C]: 2 }, [A, B, C])).toEqual({ [A]: 2, [B]: 0, [C]: 0 });
    expect(gamePoints({ [A]: 1, [B]: 1, [C]: 1 }, [A, B, C])).toEqual({ [A]: 0, [B]: 0, [C]: 0 });
  });

  test("solo: 0 punktów", () => {
    expect(gamePoints({ [A]: 1 }, [A])).toEqual({ [A]: 0 });
  });
});

describe("tabela", () => {
  const t = play(started(["g1", "g2", "g3"]), [A, B, C], { [A]: 1, [B]: 2, [C]: 3 }, { [A]: 3, [B]: 1, [C]: 2 });

  test("suma punktów malejąco, z punktami za ostatnią grę i wygranymi grami", () => {
    expect(standings(t, [A, B, C])).toEqual([
      { id: B, total: 3, last: 2, wins: 1 },
      { id: A, total: 2, last: 0, wins: 1 },
      { id: C, total: 1, last: 1, wins: 0 },
    ]);
  });

  test("przy równych punktach wyżej ten, kto wygrał więcej gier", () => {
    // A: 2 + 0 + 0, B: 0 + 1 + 1 (dwa razy remis na szczycie z C, bez wygranej).
    const tied = play(started(["g1", "g2", "g3"]), [A, B, C], { [A]: 1, [B]: 3, [C]: 2 }, { [A]: 3, [B]: 1, [C]: 1 }, { [A]: 3, [B]: 1, [C]: 1 });
    const rows = standings(tied, [B, A, C]);
    expect(rows.map((r) => [r.id, r.total, r.wins])).toEqual([
      [C, 3, 0],
      [A, 2, 1],
      [B, 2, 0],
    ]);
  });

  test("remis na szczycie to nie wygrana gra; solo też nie", () => {
    const top = play(started(["g1", "g2", "g3"]), [A, B], { [A]: 1, [B]: 1 });
    expect(standings(top, [A, B]).map((r) => r.wins)).toEqual([0, 0]);
    const solo = play(started(["g1", "g2", "g3"]), [A], { [A]: 1 });
    expect(standings(solo, [A])).toEqual([{ id: A, total: 0, last: 0, wins: 0 }]);
  });

  test("gra przerwana daje wszystkim 0 i liczy się jako rozegrana", () => {
    const broken = play(t, [A, B, C], null);
    expect(broken.index).toBe(3);
    expect(standings(broken, [A, B, C]).map((r) => [r.id, r.total, r.last])).toEqual([
      [B, 3, 0],
      [A, 2, 0],
      [C, 1, 0],
    ]);
  });

  test("gracz, który wyszedł, znika z tabeli, punkty pozostałych zostają", () => {
    expect(standings(t, [A, C]).map((r) => [r.id, r.total])).toEqual([
      [A, 2],
      [C, 1],
    ]);
  });

  test("przed pierwszą grą wszyscy mają 0, w kolejności miejsc", () => {
    expect(standings(started(["g1", "g2", "g3"]), [B, A])).toEqual([
      { id: B, total: 0, last: 0, wins: 0 },
      { id: A, total: 0, last: 0, wins: 0 },
    ]);
  });

  test("advance nie zmienia poprzedniego stanu, stan przeżywa JSON", () => {
    const before = started(["g1", "g2", "g3"]);
    const copy = JSON.parse(JSON.stringify(before));
    const after = play(before, [A, B], { [A]: 1, [B]: 2 });
    expect(before).toEqual(copy);
    expect(JSON.parse(JSON.stringify(after))).toEqual(after);
  });
});

describe("koniec i dogrywka", () => {
  const win = { [A]: 1, [B]: 2 };
  const lose = { [A]: 2, [B]: 1 };
  const draw2 = { [A]: 1, [B]: 1 };

  test("w trakcie turnieju nie ma zwycięzcy", () => {
    const t = play(started(["g1", "g2", "g3"]), [A, B], win, win);
    expect(isDone(t)).toBe(false);
    expect(winner(t, [A, B])).toBeUndefined();
  });

  test("po ostatniej grze wygrywa samodzielny lider", () => {
    const t = play(started(["g1", "g2", "g3"]), [A, B], win, lose, lose);
    expect(isDone(t)).toBe(true);
    expect(t.games).toHaveLength(3);
    expect(winner(t, [A, B])).toBe(B);
  });

  test("równe punkty, ale więcej wygranych gier: wygrywa bez dogrywki", () => {
    // A: 2 + 0 + 0 i jedna wygrana gra; B: 1 + 1 + 0 bez wygranej; C: 0 + 1 + 0.
    const t = play(started(["g1", "g2", "g3"]), [A, B, C], { [A]: 1, [B]: 2, [C]: 3 }, { [A]: 3, [B]: 1, [C]: 1 }, { [A]: 1, [B]: 1, [C]: 1 });
    expect(standings(t, [A, B, C]).map((r) => [r.id, r.total, r.wins])).toEqual([
      [A, 2, 1],
      [B, 2, 0],
      [C, 1, 0],
    ]);
    expect(isDone(t)).toBe(true);
    expect(t.games).toHaveLength(3);
    expect(winner(t, [A, B, C])).toBe(A);
  });

  test("remis na szczycie po ostatniej grze: jedna dogrywka z gry spoza rozegranych i wykluczonych", () => {
    const cfg = config(3, [], ["g4", "g5", "g6", "g7", "g8", "g9"]);
    const t = play(started(["g1", "g2", "g3"], cfg), [A, B], win, lose, draw2);
    expect(t.extra).toBe(true);
    expect(t.games).toEqual(["g1", "g2", "g3", "g10"]);
    expect(isDone(t)).toBe(false);
    expect(winner(t, [A, B])).toBeUndefined();
  });

  test("dogrywka rozstrzyga", () => {
    const t = play(started(["g1", "g2", "g3"]), [A, B], win, lose, draw2, lose);
    expect(isDone(t)).toBe(true);
    expect(t.games).toHaveLength(4);
    expect(winner(t, [A, B])).toBe(B);
  });

  test("remis po dogrywce zostaje remisem, drugiej dogrywki nie ma", () => {
    const t = play(started(["g1", "g2", "g3"]), [A, B], win, lose, draw2, draw2);
    expect(isDone(t)).toBe(true);
    expect(t.games).toHaveLength(4);
    expect(winner(t, [A, B])).toBeUndefined();
  });

  test("gdy wszystkie niewykluczone gry już były, dogrywka powtarza jedną z nich", () => {
    const cfg = config(3, [], POOL.slice(3));
    const t = play(started(["g1", "g2", "g3"], cfg), [A, B], win, lose, draw2);
    expect(t.games).toHaveLength(4);
    expect(["g1", "g2", "g3"]).toContain(t.games[3]);
  });

  test("turniej solo: bez dogrywki i bez zwycięzcy", () => {
    const t = play(started(["g1", "g2", "g3"]), [A], { [A]: 1 }, { [A]: 1 }, { [A]: 1 });
    expect(isDone(t)).toBe(true);
    expect(t.games).toHaveLength(3);
    expect(winner(t, [A])).toBeUndefined();
  });

  test("remis poniżej pierwszego miejsca nie daje dogrywki", () => {
    const t = play(started(["g1", "g2", "g3"]), [A, B, C], { [A]: 1, [B]: 2, [C]: 2 }, { [A]: 1, [B]: 2, [C]: 2 }, { [A]: 1, [B]: 2, [C]: 2 });
    expect(t.games).toHaveLength(3);
    expect(winner(t, [A, B, C])).toBe(A);
  });

  test("lider wyszedł przed końcem: liczą się tylko pozostali", () => {
    const t = play(started(["g1", "g2", "g3"]), [A, B, C], { [A]: 1, [B]: 2, [C]: 3 }, { [A]: 1, [B]: 2, [C]: 3 });
    const end = advance(t, [B, C], null, POOL, createRng(1));
    expect(isDone(end)).toBe(true);
    expect(winner(end, [B, C])).toBe(B);
  });
});
