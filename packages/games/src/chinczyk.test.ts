import { describe, expect, test } from "vitest";
import { createRng, type Rng } from "./core.ts";
import { chinczyk as game, legalMoves, type Move, type State, type View } from "./chinczyk.ts";

// Testy napisane przed implementacją. Ustalają zasady:
// - 2-4 graczy, tor 40 pól, starty co 10 pól (przy 2 graczach naprzeciw: 0 i 20),
// - pozycja pionka liczona od własnego startu: -1 domek startowy, 0-39 tor, 40-43 domek końcowy,
// - rzut: Math.floor(rng() * 6) + 1; wyjście tylko na 6; przy wszystkich pionkach w domku 3 próby,
// - 6 daje kolejny rzut, trzecia szóstka z rzędu kończy turę,
// - zbicie odsyła do domku, na własny pionek wejść nie można, do domku końcowego tylko dokładnie,
// - pole startowe z pionkiem właściciela jest bezpieczne (rywal nie może na nim stanąć),
// - w domku końcowym nie wolno przeskakiwać własnych pionków,
// - brak ruchu oddaje turę; jeden możliwy ruch wykonuje się sam (pionki w domku startowym są nierozróżnialne),
// - gra trwa do pełnego rankingu,
// - tryb Szybki: pionek na starcie, wyjście na 1 i 6, nadwyżka oczek przepada, dodatkowy rzut za zbicie i za wejście
//   do domku, koniec po pierwszym graczu z 3 pionkami w domku, 20 s na turę.

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
const quick = (players = [A, B]) => game.setup(players, createRng(1), "szybki");

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

  test("pole startowe z pionkiem właściciela jest bezpieczne: rywal nie może na nim stanąć", () => {
    const s = roll(put(two(), { [A]: [16, -1, -1, -1], [B]: [0, -1, -1, -1] }, A), A, 4); // pole 20
    expect(s.pawns[A]).toEqual([16, -1, -1, -1]);
    expect(s.pawns[B]).toEqual([0, -1, -1, -1]);
    expect(view(s).last?.note).toBe("none");
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("przy chronionym polu startowym rusza się inny pionek", () => {
    const s = roll(put(two(), { [A]: [16, 10, -1, -1], [B]: [0, -1, -1, -1] }, A), A, 4);
    expect(s.pawns[A]).toEqual([16, 14, -1, -1]);
  });

  test("chronione pole startowe wolno przeskoczyć", () => {
    const s = roll(put(two(), { [A]: [16, -1, -1, -1], [B]: [0, -1, -1, -1] }, A), A, 5);
    expect(s.pawns[A]).toEqual([21, -1, -1, -1]);
    expect(s.pawns[B]).toEqual([0, -1, -1, -1]);
  });

  test("wychodzący pionek zbija obcego na swoim polu startowym", () => {
    // Pozycja 20 u B to pole 0 toru, czyli start A.
    const s = roll(put(two(), { [B]: [20, -1, -1, -1] }, A), A, 6);
    expect(s.pawns[A]).toEqual([0, -1, -1, -1]);
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
    const s = roll(put(two(), { [A]: [38, 43, -1, -1] }, A), A, 4);
    expect(s.pawns[A]).toEqual([42, 43, -1, -1]);
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

  test("w domku końcowym nie wolno przeskoczyć własnego pionka", () => {
    // Pionek 0 musiałby minąć pole 41; pionek 1 ma wolną drogę.
    const s = roll(put(two(), { [A]: [40, 41, -1, -1] }, A), A, 2);
    expect(s.pawns[A]).toEqual([40, 43, -1, -1]);
  });

  test("wchodząc z toru też nie wolno przeskoczyć własnego pionka w domku", () => {
    const s = roll(put(two(), { [A]: [38, 40, -1, -1] }, A), A, 4);
    expect(s.pawns[A]).toEqual([38, 40, -1, -1]);
    expect(view(s).last?.note).toBe("none");
    expect(game.waitingFor(s)).toEqual([B]);
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

  test("4 graczy: pełny ranking, ostatni dopisany sam", () => {
    const home = [43, 42, 41, 39];
    let s = game.setup([A, B, C, D], createRng(1));
    s = roll(put(s, { [A]: [5, -1, -1, -1], [B]: home, [C]: home, [D]: home }, B), B, 1);
    expect(view(s).ranking).toEqual([B]);
    s = roll(s, C, 1);
    expect(game.isOver(s)).toBeNull();
    s = roll(s, D, 1);
    expect(game.isOver(s)).toEqual({ winner: B, ranking: [B, C, D, A] });
    expect(view(s).turn).toBeNull();
    expect(view(s).movable).toEqual([]);
  });

  test("ostatni pionek wprowadzony szóstką: bez dodatkowego rzutu", () => {
    let s = game.setup([A, B, C], createRng(1));
    s = roll(put(s, { [A]: [43, 42, 41, 34], [B]: [5, -1, -1, -1], [C]: [5, -1, -1, -1] }, A), A, 6);
    expect(view(s).ranking).toEqual([A]);
    expect(game.waitingFor(s)).toEqual([B]);
    expect(game.validateMove(s, A, { type: "roll" })).toBe(false);
  });

  test("wejście do domku końcowego nie zbija pionka stojącego na moim polu startowym", () => {
    // Pozycja 20 u B to pole 0 toru, czyli start A; pozycja 40 u A jest już poza torem.
    const s = roll(put(two(), { [A]: [39, 43, 42, 41], [B]: [20, -1, -1, -1] }, A), A, 1);
    expect(s.pawns[B]).toEqual([20, -1, -1, -1]);
    expect(view(s).last?.move).toEqual({ pawn: 0, from: 39, to: 40, captured: [] });
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B] });
  });

  test("ranking według kolejności kończenia", () => {
    let s = game.setup([A, B, C], createRng(1));
    s = roll(put(s, { [A]: [43, 42, 41, 39], [B]: [43, 42, 41, 39], [C]: [5, -1, -1, -1] }, A), A, 1);
    s = roll(s, B, 1);
    expect(game.isOver(s)).toEqual({ winner: A, ranking: [A, B, C] });
  });
});

describe("ostatnie zdarzenie (do animacji i komunikatów)", () => {
  test("na starcie brak zdarzenia", () => {
    expect(view(two()).last).toBeNull();
  });

  test("rzut z ruchem wykonanym samodzielnie: kto, ile, który pionek, skąd i dokąd", () => {
    const s = roll(put(two(), { [A]: [5, -1, -1, -1] }, A), A, 3);
    expect(view(s).last).toEqual({ roll: 1, player: A, dice: 3, move: { pawn: 0, from: 5, to: 8, captured: [] } });
  });

  test("przy wyborze pionka ruch dopisuje się po wyborze, numer rzutu bez zmian", () => {
    let s = roll(put(two(), { [A]: [5, 15, -1, -1] }, A), A, 3);
    expect(view(s).last).toEqual({ roll: 1, player: A, dice: 3 });
    s = move(s, A, 1);
    expect(view(s).last).toEqual({ roll: 1, player: A, dice: 3, move: { pawn: 1, from: 15, to: 18, captured: [] } });
  });

  test("wyjście z domku startowego zaczyna się od -1", () => {
    const s = roll(two(), A, 6);
    expect(view(s).last?.move).toEqual({ pawn: 0, from: -1, to: 0, captured: [] });
  });

  test("zbicie wskazuje zbitego gracza", () => {
    const s = roll(put(two(), { [A]: [5, -1, -1, -1], [B]: [28, -1, -1, -1] }, A), A, 3);
    expect(view(s).last?.move?.captured).toEqual([B]);
  });

  test("numer rzutu rośnie z każdym rzutem, także bez ruchu", () => {
    let s = roll(two(), A, 2);
    expect(view(s).last).toEqual({ roll: 1, player: A, dice: 2, note: "none" });
    s = roll(s, A, 2);
    expect(view(s).last?.roll).toBe(2);
  });

  test("trzecia szóstka z rzędu jest oznaczona", () => {
    let s = put(two(), { [A]: [5, 15, -1, -1] }, A);
    s = move(roll(s, A, 6), A, 0);
    s = move(roll(s, A, 6), A, 0);
    s = roll(s, A, 6);
    expect(view(s).last).toEqual({ roll: 3, player: A, dice: 6, note: "sixes" });
  });

  test("widok pokazuje pozostałe próby", () => {
    let s = two();
    expect(view(s).tries).toBe(3);
    s = roll(s, A, 2);
    expect(view(s).tries).toBe(2);
    s = roll(roll(s, A, 2), A, 2);
    expect(view(s).tries).toBe(3); // tura B
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

  test("limit tury: 60 s w Klasycznym, 20 s w Szybkim, także liczony z widoku", () => {
    expect(game.turn!(two()).seconds).toBe(60);
    expect(game.turn!(quick()).seconds).toBe(20);
    expect(game.turn!(view(quick()) as unknown as State).seconds).toBe(20);
  });

  test("klucz limitu zmienia się po każdym rzucie i ruchu", () => {
    const key = (s: State) => game.turn!(s).key;
    const s0 = put(two(), { [A]: [5, 15, -1, -1] }, A);
    const s1 = roll(s0, A, 3);
    const s2 = move(s1, A, 0);
    expect(new Set([key(s0), key(s1), key(s2)]).size).toBe(3);
    // Rzut bez ruchu (kolejna próba na szóstkę) też odnawia limit.
    expect(key(roll(two(), A, 2))).not.toBe(key(two()));
  });
});

describe("tryby", () => {
  test("dwa tryby, domyślny Klasyczny; nieznany tryb to Klasyczny", () => {
    expect(game.modes?.map((m) => m.id)).toEqual(["klasyczny", "szybki"]);
    expect(game.modes?.find((m) => m.default)?.id).toBe("klasyczny");
    expect(view(two()).mode).toBe("klasyczny");
    const s = game.setup([A, B], createRng(1), "cokolwiek");
    expect(view(s).mode).toBe("klasyczny");
    expect(s.pawns[A]).toEqual([-1, -1, -1, -1]);
  });

  test("widok podaje cel każdego możliwego pionka", () => {
    const s = roll(put(two(), { [A]: [5, 15, 25, -1] }, A), A, 3);
    expect(view(s).targets).toEqual({ 0: 8, 1: 18, 2: 28 });
    expect(view(two()).targets).toEqual({});
  });
});

describe("tryb Szybki", () => {
  test("każdy zaczyna z jednym pionkiem na polu startowym", () => {
    const s = quick([A, B, C]);
    expect(view(s).mode).toBe("szybki");
    for (const p of [A, B, C]) expect(s.pawns[p]).toEqual([0, -1, -1, -1]);
    expect(game.waitingFor(s)).toEqual([A]);
    expect(game.isOver(s)).toBeNull();
  });

  test("wyjście z domku startowego na 1, bez kolejnego rzutu", () => {
    const s = roll(put(quick(), { [A]: [-1, -1, -1, -1] }, A), A, 1);
    expect(s.pawns[A]).toEqual([0, -1, -1, -1]);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("wyjście na 6 daje kolejny rzut", () => {
    const s = roll(put(quick(), { [A]: [-1, -1, -1, -1] }, A), A, 6);
    expect(s.pawns[A]).toEqual([0, -1, -1, -1]);
    expect(game.waitingFor(s)).toEqual([A]);
  });

  test("nadwyżka oczek przepada: pionek wchodzi na najdalsze wolne pole domku", () => {
    const s = roll(put(quick(), { [A]: [39, 43, -1, -1] }, A), A, 5);
    expect(s.pawns[A]).toEqual([42, 43, -1, -1]);
  });

  test("przy wyborze widok pokazuje cel z obciętą nadwyżką", () => {
    const s = roll(put(quick(), { [A]: [38, 43, -1, -1] }, A), A, 6);
    expect(view(s).targets).toEqual({ 0: 42, 2: 0 });
  });

  test("pionek w domku nie cofa się na wolne pole za sobą", () => {
    const s = roll(put(quick(), { [A]: [42, 43, -1, -1] }, A), A, 5);
    expect(s.pawns[A]).toEqual([42, 43, -1, -1]);
    expect(view(s).last?.note).toBe("none");
  });

  test("własne pionki w domku wolno przeskakiwać", () => {
    const s = roll(put(quick(), { [A]: [38, 40, -1, -1] }, A), A, 4);
    expect(s.pawns[A]).toEqual([42, 40, -1, -1]);
  });

  test("zbicie daje dodatkowy rzut", () => {
    const s = roll(put(quick(), { [A]: [5, -1, -1, -1], [B]: [28, -1, -1, -1] }, A), A, 3);
    expect(s.pawns[B]).toEqual([-1, -1, -1, -1]);
    expect(view(s).phase).toBe("roll");
    expect(game.waitingFor(s)).toEqual([A]);
  });

  test("w Klasycznym zbicie nie daje dodatkowego rzutu", () => {
    const s = roll(put(two(), { [A]: [5, -1, -1, -1], [B]: [28, -1, -1, -1] }, A), A, 3);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("wejście pionka z toru do domku daje dodatkowy rzut", () => {
    const s = roll(put(quick(), { [A]: [38, -1, -1, -1] }, A), A, 3);
    expect(s.pawns[A]).toEqual([41, -1, -1, -1]);
    expect(game.waitingFor(s)).toEqual([A]);
  });

  test("ruch wewnątrz domku nie daje dodatkowego rzutu", () => {
    const s = roll(put(quick(), { [A]: [40, -1, -1, -1] }, A), A, 2);
    expect(s.pawns[A]).toEqual([42, -1, -1, -1]);
    expect(game.waitingFor(s)).toEqual([B]);
  });

  test("dwa pionki w domku jeszcze nie kończą gry", () => {
    const s = roll(put(quick(), { [A]: [43, 39, 5, -1] }, A), A, 2);
    expect(game.isOver(s)).toBeNull();
  });

  test("trzeci pionek w domku kończy partię od razu; reszta według pionków w domku, potem sumy pozycji", () => {
    let s = quick([A, B, C, D]);
    s = put(s, { [A]: [5, -1, -1, -1], [B]: [43, 5, 6, -1], [C]: [43, 42, 39, -1], [D]: [43, 20, 6, -1] }, C);
    s = roll(s, C, 2);
    expect(game.isOver(s)).toEqual({ winner: C, ranking: [C, D, B, A] });
    expect(game.waitingFor(s)).toEqual([]);
    expect(view(s).turn).toBeNull();
    expect(game.validateMove(s, D, { type: "roll" })).toBe(false);
  });

  test("po limicie ruch jest dozwolony", () => {
    const s = roll(put(quick(), { [A]: [5, 15, -1, -1] }, A), A, 1);
    expect(view(s).phase).toBe("move");
    for (let seed = 0; seed < 30; seed++) expect(game.validateMove(s, A, game.timeoutMove!(s, A, createRng(seed)))).toBe(true);
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
