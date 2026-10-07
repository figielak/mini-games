import { describe, expect, test } from "vitest";
import { createRng, type Rng } from "./core.ts";
import { chinczyk as game, legalMoves, type Move, type State, type View } from "./chinczyk.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 2-4 graczy, tor 40 pól, starty co 10 pól (przy 2 graczach naprzeciw: 0 i 20),
// - pozycja pionka liczona od własnego startu: -1 domek startowy, 0-39 tor, 40-43 domek końcowy,
// - rzut: Math.floor(rng() * 6) + 1; wyjście tylko na 6; przy wszystkich pionkach w domku 3 próby,
// - 6 daje kolejny rzut, trzecia szóstka z rzędu kończy turę,
// - zbicie odsyła do domku, na własny pionek wejść nie można, do domku końcowego tylko dokładnie,
// - brak ruchu oddaje turę; jeden możliwy ruch wykonuje się sam (pionki w domku startowym są nierozróżnialne),
// - gra trwa do pełnego rankingu.

const A = "ania";
const B = "bartek";
const C = "celina";
const D = "darek";

/** Kostka sterowana w testach: kolejne wywołania dają zadane oczka. */
function dice(...rolls: number[]): Rng {
  let i = 0;
  return () => {
    if (i >= rolls.length) throw new Error("test nie przewidział tylu rzutów");
    return (rolls[i++] - 1) / 6 + 0.001;
  };
}

const view = (s: State) => game.playerView(s, A) as View;

/** Ustawia pionki i gracza na turze (faza rzutu, bez serii szóstek). */
function put(s: State, pawns: Record<string, number[]>, turn: string): State {
  return { ...s, pawns: { ...s.pawns, ...pawns }, turn: s.players.indexOf(turn), phase: "roll", sixes: 0 };
}

function roll(s: State, player: string, n: number): State {
  expect(game.validateMove(s, player, { type: "roll" }), `${player} rzuca`).toBe(true);
  return game.applyMove(s, player, { type: "roll" }, dice(n));
}

function move(s: State, player: string, pawn: number): State {
  expect(game.validateMove(s, player, { type: "move", pawn }), `${player} rusza pionek ${pawn}`).toBe(true);
  return game.applyMove(s, player, { type: "move", pawn }, dice());
}

const two = () => game.setup([A, B], createRng(1));

describe("setup", () => {
  test.each([2, 3, 4])("%i graczy: wszystkie pionki w domku, rzuca pierwszy", (n) => {
    const players = [A, B, C, D].slice(0, n);
    const s = game.setup(players, createRng(1));
    for (const p of players) expect(s.pawns[p]).toEqual([-1, -1, -1, -1]);
    expect(game.waitingFor(s)).toEqual([A]);
    expect(view(s).phase).toBe("roll");
  });

  test("przy 2 graczach starty są naprzeciw siebie", () => {
    expect(view(two()).starts).toEqual({ [A]: 0, [B]: 20 });
  });

  test("przy 4 graczach starty co 10 pól", () => {
    expect(view(game.setup([A, B, C, D], createRng(1))).starts).toEqual({ [A]: 0, [B]: 10, [C]: 20, [D]: 30 });
  });

  test("gra dla 2-4 graczy", () => {
    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(4);
  });
});

describe("rzut", () => {
  test("rzuca tylko gracz na turze", () => {
    expect(game.validateMove(two(), B, { type: "roll" })).toBe(false);
    expect(game.validateMove(two(), "obcy", { type: "roll" })).toBe(false);
  });

  test("wynik rzutu widać w widoku", () => {
    const s = roll(put(two(), { [A]: [5, -1, -1, -1] }, A), A, 4);
    expect(view(s).dice).toBe(4);
  });

  test("w fazie wyboru pionka nie można rzucać ponownie", () => {
    const s = roll(put(two(), { [A]: [5, 15, -1, -1] }, A), A, 3);
    expect(view(s).phase).toBe("move");
    expect(game.validateMove(s, A, { type: "roll" })).toBe(false);
  });

  test("ruch pionkiem przed rzutem jest odrzucany", () => {
    expect(game.validateMove(put(two(), { [A]: [5, -1, -1, -1] }, A), A, { type: "move", pawn: 0 })).toBe(false);
  });
});

describe("domek startowy", () => {
  test("wszystkie w domku: 3 próby na szóstkę, potem tura przechodzi", () => {
    let s = two();
    s = roll(s, A, 3);
    expect(game.waitingFor(s)).toEqual([A]);
    s = roll(s, A, 2);
    expect(game.waitingFor(s)).toEqual([A]);
    s = roll(s, A, 5);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("następny gracz też ma 3 próby", () => {
    let s = roll(roll(roll(two(), A, 1), A, 1), A, 1);
    s = roll(roll(s, B, 1), B, 1);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("szóstka wyprowadza pionek na start i daje kolejny rzut", () => {
    const s = roll(two(), A, 6);
    expect(s.pawns[A]).toEqual([0, -1, -1, -1]);
    expect(game.waitingFor(s)).toEqual([A]);
    expect(view(s).phase).toBe("roll");
  });

  test("bez szóstki pionek nie wychodzi, nawet gdy na torze jest inny", () => {
    const s = roll(put(two(), { [A]: [5, -1, -1, -1] }, A), A, 3);
    expect(s.pawns[A]).toEqual([8, -1, -1, -1]); // jedyny ruch wykonał się sam
  });

  test("pionek na torze to jedna próba: nie-6 bez ruchu kończy turę od razu", () => {
    const s = roll(put(two(), { [A]: [38, 43, -1, -1] }, A), A, 5); // 38+5=43 zajęte, wyjście tylko na 6
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("bez pionków na torze (reszta w domku końcowym) też są 3 próby", () => {
    let s = roll(put(two(), { [A]: [43, 42, 41, -1] }, A), A, 3);
    expect(game.waitingFor(s)).toEqual([A]);
    s = roll(roll(s, A, 3), A, 3);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("własny pionek na starcie blokuje wyjście", () => {
    const s = roll(put(two(), { [A]: [0, 10, -1, -1] }, A), A, 6);
    expect(view(s).phase).toBe("move");
    expect(legalMoves(s).sort()).toEqual([0, 1]);
  });
});

describe("ruch", () => {
  test("pionek idzie o liczbę oczek, po nie-6 tura przechodzi", () => {
    let s = roll(put(two(), { [A]: [5, 10, -1, -1] }, A), A, 3);
    s = move(s, A, 0);
    expect(s.pawns[A]).toEqual([8, 10, -1, -1]);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("ruch pionkiem, którym nie można się ruszyć, jest odrzucany", () => {
    const s = roll(put(two(), { [A]: [5, 10, -1, -1] }, A), A, 3);
    expect(game.validateMove(s, A, { type: "move", pawn: 2 })).toBe(false);
    expect(game.validateMove(s, A, { type: "move", pawn: 7 })).toBe(false);
    expect(game.validateMove(s, B, { type: "move", pawn: 0 })).toBe(false);
  });

  test("nie można wejść na własny pionek", () => {
    const s = roll(put(two(), { [A]: [5, 8, -1, -1] }, A), A, 3);
    expect(s.pawns[A]).toEqual([5, 11, -1, -1]); // pionek 0 zablokowany, pionek 1 ruszył się sam
  });

  test("zbicie odsyła pionek przeciwnika do domku", () => {
    // B startuje z pola 20; pozycja 28 B to pole 8 na torze.
    const s = roll(put(two(), { [A]: [5, -1, -1, -1], [B]: [28, -1, -1, -1] }, A), A, 3);
    expect(s.pawns[A]).toEqual([8, -1, -1, -1]);
    expect(s.pawns[B]).toEqual([-1, -1, -1, -1]);
  });

  test("można zbić pionek stojący na swoim polu startowym", () => {
    const s = roll(put(two(), { [A]: [16, -1, -1, -1], [B]: [0, -1, -1, -1] }, A), A, 4); // pole 20
    expect(s.pawns[B]).toEqual([-1, -1, -1, -1]);
  });

  test("tor jest wspólny: ruch przez start przeciwnika", () => {
    const s = roll(put(two(), { [A]: [18, -1, -1, -1] }, A), A, 4);
    expect(s.pawns[A]).toEqual([22, -1, -1, -1]);
  });

  test("zbicie działa też tuż za moim startem", () => {
    // B na pozycji 25 = pole 5 na torze; A z pozycji 2 o 3 zbija go na polu 5.
    const s = roll(put(two(), { [A]: [2, -1, -1, -1], [B]: [25, -1, -1, -1] }, A), A, 3);
    expect(s.pawns[B]).toEqual([-1, -1, -1, -1]);
  });
});

describe("domek końcowy", () => {
  test("wejście do domku dokładną liczbą oczek", () => {
    const s = roll(put(two(), { [A]: [38, 40, 41, -1] }, A), A, 4);
    expect(s.pawns[A]).toEqual([42, 40, 41, -1]);
  });

  test("przekroczenie domku i zajęte pole domku są niedozwolone", () => {
    const s0 = put(two(), { [A]: [38, 43, 42, 41] }, A);
    expect(legalMoves(roll(s0, A, 6))).toEqual([]);
    const s = roll(s0, A, 5); // 38+5=43 zajęte, reszta poza domkiem
    expect(s.pawns[A]).toEqual([38, 43, 42, 41]);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("w domku końcowym można się jeszcze przesunąć", () => {
    const s = roll(put(two(), { [A]: [40, 43, 42, -1] }, A), A, 1);
    expect(s.pawns[A]).toEqual([41, 43, 42, -1]);
  });
});

describe("szóstki", () => {
  test("6 daje kolejny rzut po ruchu", () => {
    let s = roll(put(two(), { [A]: [5, -1, -1, -1] }, A), A, 6);
    expect(view(s).phase).toBe("move"); // ruch pionkiem albo wyjście
    s = move(s, A, 0);
    expect(game.waitingFor(s)).toEqual([A]);
    expect(view(s).phase).toBe("roll");
  });

  test("6 bez możliwego ruchu też daje kolejny rzut", () => {
    const s = roll(put(two(), { [A]: [38, 43, 42, 41] }, A), A, 6);
    expect(game.waitingFor(s)).toEqual([A]);
  });

  test("trzecia szóstka z rzędu kończy turę bez ruchu", () => {
    let s = put(two(), { [A]: [5, 15, -1, -1] }, A);
    s = move(roll(s, A, 6), A, 0); // 11
    s = move(roll(s, A, 6), A, 0); // 17
    s = roll(s, A, 6);
    expect(s.pawns[A]).toEqual([17, 15, -1, -1]);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("seria szóstek liczy się od nowa w następnej turze", () => {
    let s = put(two(), { [A]: [5, 15, -1, -1], [B]: [5, -1, -1, -1] }, A);
    s = move(roll(s, A, 6), A, 0);
    s = move(roll(s, A, 6), A, 0);
    s = roll(s, A, 6); // tura przepada
    s = roll(s, B, 2); // B: jedyny ruch, wykonuje się sam
    s = move(roll(s, A, 6), A, 0);
    expect(game.waitingFor(s)).toEqual([A]); // to pierwsza szóstka w tej turze
  });
});

describe("koniec gry i ranking", () => {
  test("przy 2 graczach pierwszy, który wprowadzi wszystkie pionki, kończy partię", () => {
    const s = roll(put(two(), { [A]: [43, 42, 41, 39] }, A), A, 1);
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
    expect(game.waitingFor(s)).toEqual([]);
    expect(game.validateMove(s, B, { type: "roll" })).toBe(false);
  });

  test("przy 3 graczach gra toczy się dalej, a skończony gracz wypada z kolejki", () => {
    let s = game.setup([A, B, C], createRng(1));
    s = roll(put(s, { [A]: [43, 42, 41, 39], [B]: [5, -1, -1, -1], [C]: [5, -1, -1, -1] }, A), A, 1);
    expect(game.isOver(s)).toBeNull();
    expect(game.waitingFor(s)).toEqual([B]);
    s = roll(s, B, 2);
    expect(game.waitingFor(s)).toEqual([C]);
    s = roll(s, C, 2);
    expect(game.waitingFor(s)).toEqual([B]); // A pominięta
  });

  test("ranking według kolejności kończenia", () => {
    let s = game.setup([A, B, C], createRng(1));
    s = roll(put(s, { [A]: [43, 42, 41, 39], [B]: [43, 42, 41, 39], [C]: [5, -1, -1, -1] }, A), A, 1);
    s = roll(s, B, 1);
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B, C] });
  });
});

describe("tura i limit czasu", () => {
  test("po limicie w fazie rzutu serwer rzuca", () => {
    const s = two();
    expect(game.timeoutMove!(s, A, createRng(1))).toEqual({ type: "roll" });
  });

  test("po limicie w fazie wyboru ruch jest dozwolony", () => {
    const s = roll(put(two(), { [A]: [5, 15, 25, -1] }, A), A, 3);
    for (let seed = 0; seed < 30; seed++) {
      const m = game.timeoutMove!(s, A, createRng(seed));
      expect(game.validateMove(s, A, m)).toBe(true);
    }
  });

  test("limit czasu tury jest ustawiony", () => {
    expect(game.turnSeconds).toBeGreaterThan(0);
  });
});

describe("stan", () => {
  test("applyMove nie zmienia poprzedniego stanu", () => {
    const before = put(two(), { [A]: [5, -1, -1, -1] }, A);
    const snapshot = structuredClone(before);
    game.applyMove(before, A, { type: "roll" }, dice(3));
    expect(before).toEqual(snapshot);
  });

  test("stan przeżywa zapis do JSON", () => {
    const s = roll(put(two(), { [A]: [5, 15, -1, -1] }, A), A, 3);
    const restored = JSON.parse(JSON.stringify(s)) as State;
    expect(game.validateMove(restored, A, { type: "move", pawn: 1 })).toBe(true);
  });

  test("obaj gracze i obserwator widzą to samo", () => {
    const s = roll(two(), A, 6);
    expect(game.playerView(s, A)).toEqual(game.playerView(s, B));
    expect(game.playerView(s, A)).toEqual(game.playerView(s, ""));
  });

  test("schemat ruchu odrzuca śmieci z sieci", () => {
    const ok = (m: unknown) => game.moveSchema.safeParse(m).success;
    expect(ok({ type: "roll" } satisfies Move)).toBe(true);
    expect(ok({ type: "move", pawn: 2 } satisfies Move)).toBe(true);
    expect(ok({ type: "move", pawn: "2" })).toBe(false);
    expect(ok({ type: "move", pawn: 4 })).toBe(false);
    expect(ok({ type: "cheat" })).toBe(false);
  });
});
