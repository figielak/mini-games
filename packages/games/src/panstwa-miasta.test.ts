import { describe, expect, test } from "vitest";
import { createRng } from "./core.ts";
import { CATEGORIES, LETTERS, type Move, panstwaMiasta as game, ROUNDS, type State, type View } from "./panstwa-miasta.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 6 kategorii, 5 rund, każda na inną literę,
// - wszyscy piszą naraz; kto pierwszy odda komplet, daje STOP (reszta ma 10 s),
// - potem głosowanie: odpowiedź odpada, gdy odrzuci ją ponad połowa pozostałych; zła litera odpada sama,
// - punkty: 15 jedyna ważna w kategorii, 10 unikalna, 5 powtórzona, 0 brak/odrzucona,
// - ranking po sumie punktów.

const A = "ania";
const B = "bartek";
const C = "celina";

const write = (answers: string[], done = true): Move => ({ type: "write", answers, done });
const vote = (...rejected: [string, number][]): Move => ({ type: "vote", rejected: rejected.map(([player, category]) => ({ player, category })) });
const next: Move = { type: "next" };

function send(s: State, player: string, move: Move): State {
  expect(game.validateMove(s, player, move), `${player}: ${JSON.stringify(move)}`).toBe(true);
  return game.applyMove(s, player, move, createRng(1));
}

/** Sześć odpowiedzi na literę: każda zaczyna się od niej, puste tam, gdzie ""; reszta słowa z `words`. */
const on = (letter: string, ...words: string[]) => CATEGORIES.map((_, i) => (words[i] === "" ? "" : letter + (words[i] ?? `x${i}`)));

/** Setup z ustaloną pierwszą literą. */
function start(players: string[], letter = "K"): State {
  const s = game.setup(players, createRng(1));
  return { ...s, letters: [letter, ...s.letters.slice(1)] };
}

/** Wszyscy oddają odpowiedzi, potem wszyscy głosują bez odrzuceń. */
function round(s: State, answers: Record<string, string[]>, votes: Record<string, Move> = {}): State {
  for (const p of s.players) s = send(s, p, write(answers[p]));
  for (const p of s.players) s = send(s, p, votes[p] ?? vote());
  return s;
}

const roundScores = (s: State, p: string) => (game.playerView(s, p) as View).roundScores[p];

test("setup: 6 kategorii, 5 różnych liter z puli, wszyscy piszą", () => {
  const s = game.setup([A, B], createRng(7));
  expect(CATEGORIES).toHaveLength(6);
  expect(s.letters).toHaveLength(ROUNDS);
  expect(ROUNDS).toBe(5);
  expect(new Set(s.letters).size).toBe(ROUNDS);
  expect(s.letters.every((l) => LETTERS.includes(l))).toBe(true);
  expect(game.waitingFor(s)).toEqual([A, B]);
  expect(game.turn!(s)).toEqual({ key: "write:0:", seconds: 90 });
});

describe("pisanie", () => {
  test("szkic nie kończy pisania, ale serwer go pamięta", () => {
    let s = start([A, B]);
    s = send(s, A, write(on("K"), false));
    expect(game.waitingFor(s)).toEqual([A, B]);
    expect((game.playerView(s, A) as View).answers[A]).toEqual(on("K"));
    expect(s.stop).toBeNull();
  });

  test("Gotowe z kompletem daje STOP i skraca czas do 10 s", () => {
    let s = start([A, B, C]);
    s = send(s, A, write(on("K")));
    expect(s.stop).toBe(A);
    expect(game.waitingFor(s)).toEqual([B, C]);
    expect(game.turn!(s)).toEqual({ key: `write:0:${A}`, seconds: 10 });
    // drugi komplet nie przejmuje STOP-u
    s = send(s, B, write(on("K")));
    expect(s.stop).toBe(A);
  });

  test("Gotowe bez kompletu nie daje STOP-u", () => {
    let s = start([A, B]);
    s = send(s, A, write(on("K", "", "a")));
    expect(s.stop).toBeNull();
    s = send(s, B, write(["  ", ...on("K").slice(1)]));
    expect(s.stop).toBeNull();
  });

  test("po Gotowe nie można już pisać; obcy i zła faza odpadają", () => {
    let s = start([A, B]);
    s = send(s, A, write(on("K")));
    expect(game.validateMove(s, A, write(on("K"), false))).toBe(false);
    expect(game.validateMove(s, C, write(on("K")))).toBe(false);
    expect(game.validateMove(s, B, vote())).toBe(false);
    expect(game.validateMove(s, B, next)).toBe(false);
  });

  test("schemat: 6 odpowiedzi po max 30 znaków", () => {
    expect(game.moveSchema.safeParse(write(on("K"))).success).toBe(true);
    expect(game.moveSchema.safeParse(write(on("K").slice(1))).success).toBe(false);
    expect(game.moveSchema.safeParse(write([..."abcde", "x".repeat(31)])).success).toBe(false);
  });

  test("ukrywanie: w trakcie pisania widać tylko swój szkic", () => {
    let s = start([A, B]);
    s = send(s, A, write(on("K", "omar"), false));
    s = send(s, B, write(on("K", "rokodyl")));
    const forA = game.playerView(s, A) as View;
    expect(forA.answers[A]).toEqual(on("K", "omar"));
    expect(forA.answers[B]).toBeUndefined();
    expect(forA.done).toEqual([B]);
    const forObserver = JSON.stringify(game.playerView(s, ""));
    expect(forObserver).not.toContain("omar");
    expect(forObserver).not.toContain("rokodyl");
  });

  test("timeout: zapisany szkic jako Gotowe, a bez szkicu puste pola", () => {
    let s = start([A, B]);
    s = send(s, A, write(on("K"), false));
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual(write(on("K")));
    expect(game.timeoutMove!(s, B, createRng(1))).toEqual(write(["", "", "", "", "", ""]));
  });
});

describe("głosowanie", () => {
  function voting(players: string[]) {
    let s = start(players);
    for (const p of players) s = send(s, p, write(on("K", `a${p}`, `b${p}`, `c${p}`, `d${p}`, `e${p}`, `f${p}`)));
    return s;
  }

  test("po pisaniu wszystkie odpowiedzi są jawne", () => {
    const s = voting([A, B]);
    expect(s.phase).toBe("vote");
    expect(game.turn!(s)).toEqual({ key: "vote:0:", seconds: 45 });
    expect((game.playerView(s, "") as View).answers[B]).toEqual(on("K", `a${B}`, `b${B}`, `c${B}`, `d${B}`, `e${B}`, `f${B}`));
  });

  test("nie można odrzucić własnej ani nieistniejącej odpowiedzi, głos tylko raz", () => {
    let s = voting([A, B]);
    expect(game.validateMove(s, A, vote([A, 0]))).toBe(false);
    expect(game.validateMove(s, A, vote([C, 0]))).toBe(false);
    expect(game.validateMove(s, A, vote([B, 6]))).toBe(false);
    s = send(s, A, vote([B, 0]));
    expect(game.validateMove(s, A, vote())).toBe(false);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("2 graczy: jeden głos przeciw wystarcza", () => {
    let s = voting([A, B]);
    s = send(s, A, vote([B, 0]));
    s = send(s, B, vote());
    expect(roundScores(s, B)).toEqual([0, 10, 10, 10, 10, 10]);
  });

  test("3 graczy: trzeba 2 głosów", () => {
    let s = voting([A, B, C]);
    s = send(s, A, vote([C, 0], [C, 1]));
    s = send(s, B, vote([C, 1]));
    s = send(s, C, vote());
    expect(roundScores(s, C)).toEqual([10, 0, 10, 10, 10, 10]);
  });

  test("6 graczy: 2 z 5 to za mało, 3 wystarcza", () => {
    const six = ["p1", "p2", "p3", "p4", "p5", "p6"];
    let s = voting(six);
    s = send(s, "p1", vote(["p6", 0], ["p6", 1]));
    s = send(s, "p2", vote(["p6", 0], ["p6", 1]));
    s = send(s, "p3", vote(["p6", 1]));
    for (const p of ["p4", "p5", "p6"]) s = send(s, p, vote());
    expect(roundScores(s, "p6")).toEqual([10, 0, 10, 10, 10, 10]);
  });

  test("timeout: głos bez odrzuceń", () => {
    expect(game.timeoutMove!(voting([A, B]), A, createRng(1))).toEqual(vote());
  });
});

describe("punkty", () => {
  test("15 jedyna ważna, 10 unikalna, 5 powtórzona (bez polskich znaków i wielkości), 0 pusta lub zła litera", () => {
    let s = start([A, B, C], "Ł");
    s = round(s, {
      [A]: ["Łotwa", "Łódź", "Łoś", "Łubin", "Łyżka", ""],
      [B]: ["", " lodz ", "Łasica", "Łubin", "Kubek", ""],
      [C]: ["", "ŁÓDŹ", "Łabędź", "łubin", "", "Łucja"],
    });
    // Państwo: tylko A; Miasto: Łódź u A i C (B pisze " lodz ", czyli na L, nie Ł); Zwierzę: wszystkie różne; Roślina: Łubin x3;
    // Rzecz: Kubek na złą literę, więc Łyżka jedyna; Imię: tylko C.
    expect(roundScores(s, A)).toEqual([15, 5, 10, 5, 15, 0]);
    expect(roundScores(s, B)).toEqual([0, 0, 10, 5, 0, 0]);
    expect(roundScores(s, C)).toEqual([0, 5, 10, 5, 0, 15]);
    expect(s.totals).toEqual({ [A]: 50, [B]: 15, [C]: 35 });
  });

  test("odrzucona odpowiedź nie robi duplikatu", () => {
    let s = start([A, B, C]);
    s = round(s, { [A]: on("K", "ot"), [B]: on("K", "ot", "q"), [C]: on("K", "", "q") }, { [A]: vote([B, 0]), [C]: vote([B, 0]) });
    expect(roundScores(s, A)[0]).toBe(15);
  });
});

describe("rundy i koniec", () => {
  test("podsumowanie, Dalej, kolejna litera; po 5 rundach ranking", () => {
    let s = game.setup([A, B], createRng(3));
    for (let r = 0; r < ROUNDS; r++) {
      const letter = s.letters[r];
      expect(s.round).toBe(r);
      // A zawsze pisze komplet, B tylko jedną odpowiedź taką samą jak A
      s = round(s, { [A]: on(letter), [B]: on(letter, "x0", "", "", "", "", "") });
      if (r < ROUNDS - 1) {
        expect(s.phase).toBe("summary");
        expect(game.isOver(s)).toBeNull();
        expect(game.turn!(s)).toEqual({ key: `summary:${r}:`, seconds: 20 });
        expect(game.timeoutMove!(s, A, createRng(1))).toEqual(next);
        s = send(s, A, next);
        expect(game.waitingFor(s)).toEqual([B]);
        s = send(s, B, next);
        expect(s.phase).toBe("write");
        expect(s.stop).toBeNull();
        expect((game.playerView(s, A) as View).answers[A]).toBeUndefined();
      }
    }
    expect(s.phase).toBe("over");
    expect(game.waitingFor(s)).toEqual([]);
    expect(s.totals).toEqual({ [A]: 5 * (5 + 5 * 15), [B]: 5 * 5 });
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
  });

  test("remis: bez zwycięzcy", () => {
    let s = game.setup([A, B], createRng(3));
    for (let r = 0; r < ROUNDS; r++) {
      s = round(s, { [A]: on(s.letters[r]), [B]: on(s.letters[r]) });
      if (s.phase === "summary") s = send(send(s, A, next), B, next);
    }
    expect(game.isOver(s)).toEqual({ ranking: [A, B] });
  });
});
