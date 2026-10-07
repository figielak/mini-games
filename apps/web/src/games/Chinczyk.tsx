import { DiceFive, DiceFour, DiceOne, DiceSix, DiceThree, DiceTwo } from "@phosphor-icons/react";
import { CHINCZYK_TRACK as TRACK, type ChinczykView, type LobbyPlayer } from "@mini-games/games";

type Move = { type: "roll" } | { type: "move"; pawn: number };

interface Props {
  view: ChinczykView;
  me: string;
  players: LobbyPlayer[];
  canMove: boolean;
  onMove: (move: Move) => void;
}

type Cell = [x: number, y: number];

/** Tor 40 pól na siatce 11×11, zgodnie z ruchem wskazówek zegara, od startu z lewego ramienia krzyża. */
const TRACK_CELLS: Cell[] = [
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0],
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [10, 5],
  [10, 6], [9, 6], [8, 6], [7, 6], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [5, 10],
  [4, 10], [4, 9], [4, 8], [4, 7], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 5],
];
/** Domki końcowe i startowe dla startów 0, 10, 20, 30 (lewo, góra, prawo, dół). */
const HOMES: Cell[][] = [
  [[1, 5], [2, 5], [3, 5], [4, 5]],
  [[5, 1], [5, 2], [5, 3], [5, 4]],
  [[9, 5], [8, 5], [7, 5], [6, 5]],
  [[5, 9], [5, 8], [5, 7], [5, 6]],
];
const BASES: Cell[][] = [
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[9, 0], [10, 0], [9, 1], [10, 1]],
  [[9, 9], [10, 9], [9, 10], [10, 10]],
  [[0, 9], [1, 9], [0, 10], [1, 10]],
];
const DICE = [DiceOne, DiceTwo, DiceThree, DiceFour, DiceFive, DiceSix];

const key = ([x, y]: Cell) => y * 11 + x;
const mix = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--color-bg))`;

export function Chinczyk({ view, me, players, canMove, onMove }: Props) {
  const color = (id: string) => players.find((p) => p.id === id)?.color ?? "#8b8b92";
  const myMove = canMove && view.phase === "move";

  // Każde pole planszy: tło (tor, start, domek gracza) i ewentualny pionek.
  const cells = new Map<number, { background?: string; owner?: string; pawn?: { player: string; index: number } }>();
  for (const c of TRACK_CELLS) cells.set(key(c), {});
  for (const player of view.players) {
    const seat = view.starts[player] / (TRACK / 4);
    const c = color(player);
    cells.set(key(TRACK_CELLS[view.starts[player]]), { background: mix(c, 45), owner: player });
    for (const cell of HOMES[seat]) cells.set(key(cell), { background: mix(c, 22), owner: player });
    for (const cell of BASES[seat]) cells.set(key(cell), { background: mix(c, 14), owner: player });

    view.pawns[player].forEach((pos, index) => {
      const cell =
        pos < 0 ? BASES[seat][index] : pos < TRACK ? TRACK_CELLS[(view.starts[player] + pos) % TRACK] : HOMES[seat][pos - TRACK];
      cells.set(key(cell), { ...cells.get(key(cell)), pawn: { player, index } });
    });
  }

  const Dice = view.dice ? DICE[view.dice - 1] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid aspect-square w-full gap-[3px]" style={{ gridTemplateColumns: "repeat(11, minmax(0, 1fr))" }}>
        {Array.from({ length: 121 }, (_, i) => {
          const cell = cells.get(i);
          if (!cell) return <span key={i} />;
          const pawn = cell.pawn;
          const movable = !!pawn && myMove && pawn.player === me && view.movable.includes(pawn.index);
          const inner = pawn && (
            <span
              className={`size-[70%] rounded-full border-2 border-bg ${movable ? "outline-2 outline-offset-1 outline-accent" : ""}`}
              style={{ backgroundColor: color(pawn.player) }}
            />
          );
          // Tor wyraźnie jaśniejszy od tła: surface-inset zlewał się ze stroną.
          const className = "grid place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-fg)_11%,var(--color-bg))]";
          return movable ? (
            <button
              key={i}
              type="button"
              aria-label={`Rusz pionek ${pawn!.index + 1}`}
              className={className}
              style={{ backgroundColor: cell.background }}
              onClick={() => onMove({ type: "move", pawn: pawn!.index })}
            >
              {inner}
            </button>
          ) : (
            <span key={i} className={className} style={{ backgroundColor: cell.background }}>
              {inner}
            </span>
          );
        })}
      </div>

      <div className="tile flex min-h-20 items-center gap-4 p-4">
        {Dice ? (
          <Dice size={48} weight="fill" style={{ color: view.turn ? color(view.turn) : undefined }} aria-label={`Wyrzucono ${view.dice}`} />
        ) : (
          <span className="size-12 rounded-inset border border-line" aria-hidden />
        )}
        <div className="flex-1">
          {canMove && view.phase === "roll" ? (
            <button type="button" className="btn btn-primary w-full" onClick={() => onMove({ type: "roll" })}>
              Rzuć kostką
            </button>
          ) : (
            <p className="text-sm text-fg-muted">
              {myMove ? "Dotknij podświetlonego pionka." : view.dice ? `Ostatni rzut: ${view.dice}` : "Czekamy na pierwszy rzut."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
