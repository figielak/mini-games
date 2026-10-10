import { describe, expect, test } from "vitest";
import { createRng, GAMES } from "./index.ts";

// Kontrakt wspólny dla każdej gry z rejestru, sprawdzany na losowych partiach granych ruchami po limicie czasu:
// - ruch po limicie czasu każdego gracza, na którego czekamy, przechodzi przez moveSchema i validateMove,
// - ten sam ruch od kogoś spoza gry albo od gracza, na którego nie czekamy, jest odrzucany,
// - partia się kończy, po końcu nikt nie może już nic zrobić, a wynik wskazuje tylko graczy tej partii,
// - widok każdego gracza i obserwatora ("") da się wysłać jako JSON na każdym etapie.

const STRANGER = "obcy";
const SEEDS = [1, 2, 3];
const MAX_STEPS = 100_000;
/** Fazy odwiedzone w losowych partiach, po id gry. */
const visited: Record<string, Set<string>> = {};

/** Ruchy „chętnego” gracza: sam timeoutMove nigdy nie kupuje, więc nie doszedłby do budowy, wykupu, sprzedaży ani Juwenaliów. */
const EAGER: Record<string, (rng: () => number) => unknown[]> = {
  "kampus-tour": (rng) => [{ type: "buy" }, { type: "buyout" }, { type: "build", level: 1 }, { type: "travel", tile: Math.floor(rng() * 32) }],
};

test("rejestr: id z sieci nie trafia w pola prototypu obiektu, a klucz to id gry", () => {
  for (const id of ["constructor", "toString", "__proto__", "hasOwnProperty", "nie-ma-takiej"]) expect(GAMES[id], id).toBeUndefined();
  expect(Object.keys(GAMES)).toHaveLength(20);
  for (const [id, game] of Object.entries(GAMES)) expect(game.id).toBe(id);
});

// Gra z trybami przechodzi kontrakt w każdym trybie.
const CASES = Object.values(GAMES).flatMap((game) =>
  (game.modes ?? [undefined]).map((mode) => ({ game, mode: mode?.id, name: mode ? `${game.name} (${mode.name})` : game.name })),
);

describe.each(CASES)("$name: kontrakt", ({ game, mode }) => {
  test.each([...new Set([game.minPlayers, game.maxPlayers])])("%i graczy: losowa partia do końca", (n) => {
    for (const seed of SEEDS) {
      const players = ["p1", "p2", "p3", "p4", "p5", "p6"].slice(0, n);
      const rng = createRng(seed);
      const views = (s: unknown) => [...players, ""].map((viewer) => JSON.stringify(game.playerView(s, viewer)));
      const seen = new Map<string, unknown>();
      const phases = (visited[game.id] ??= new Set());
      let s = game.setup(players, rng, mode);

      for (let steps = 0; !game.isOver(s); steps++) {
        if (steps > MAX_STEPS) throw new Error(`seed ${seed}: partia się nie kończy`);
        const waiting = game.waitingFor(s);
        expect(waiting.length, "w trakcie gry zawsze na kogoś czekamy").toBeGreaterThan(0);
        for (const p of waiting) {
          const fallback = game.timeoutMove!(s, p, rng);
          expect(game.moveSchema.safeParse(fallback).success, `seed ${seed}, ruch ${steps}: schemat ${JSON.stringify(fallback)}`).toBe(true);
          expect(game.validateMove(s, p, fallback), `seed ${seed}, ruch ${steps}: timeoutMove ${p} ${JSON.stringify(fallback)}`).toBe(true);
        }
        const player = waiting[Math.floor(rng() * waiting.length)];
        const eager = rng() < 0.7 ? EAGER[game.id]?.(rng).find((m) => game.validateMove(s, player, m)) : undefined;
        const move = eager ?? game.timeoutMove!(s, player, rng);
        phases.add((s as { phase?: string }).phase ?? "");
        const label = `seed ${seed}, ruch ${steps}: ${JSON.stringify(move).slice(0, 80)}`;

        expect(game.moveSchema.safeParse(move).success, label).toBe(true);
        expect(game.validateMove(s, player, move), label).toBe(true);
        expect(game.validateMove(s, STRANGER, move), `${label} (obcy)`).toBe(false);
        for (const other of players) {
          if (!waiting.includes(other)) expect(game.validateMove(s, other, move), `${label} (${other} poza turą)`).toBe(false);
        }
        views(s);

        seen.set(JSON.stringify(move), move);
        s = game.applyMove(s, player, move, rng);
      }

      expect(game.waitingFor(s)).toEqual([]);
      views(s);
      const { winner, ranking } = game.isOver(s)!;
      if (winner !== undefined) expect(players, `seed ${seed}: zwycięzca`).toContain(winner);
      if (ranking) {
        expect([...ranking].sort(), `seed ${seed}: ranking to wszyscy gracze, każdy raz`).toEqual([...players].sort());
        if (winner !== undefined) expect(ranking[0]).toBe(winner);
      }
      for (const move of seen.values()) {
        for (const player of [...players, STRANGER]) {
          expect(game.validateMove(s, player, move), `seed ${seed}, po końcu: ${player} ${JSON.stringify(move).slice(0, 80)}`).toBe(false);
        }
      }
    }
  });
});

test("losowe partie przeszły przez każdą fazę gier wielofazowych (timeoutMove sprawdzony w każdej)", () => {
  const expected: Record<string, string[]> = {
    "kampus-tour": ["pick", "roll", "card", "buy", "buyout", "build", "sell", "juwenalia"],
    chinczyk: ["roll", "move"],
    statki: ["placing", "battle"],
    "panstwa-miasta": ["write", "vote", "summary"],
  };
  for (const [id, phases] of Object.entries(expected)) expect([...visited[id]].sort(), id).toEqual([...phases].sort());
});
