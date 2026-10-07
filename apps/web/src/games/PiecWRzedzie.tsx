import type { LobbyPlayer, PiecWRzedzieView } from "@mini-games/games";
import { useState } from "react";

interface Props {
  view: PiecWRzedzieView;
  players: LobbyPlayer[];
  canMove: boolean;
  onMove: (move: { x: number; y: number }) => void;
}

/**
 * Pole ma ~24px na telefonie, więc ruch idzie w dwóch krokach: pierwsze dotknięcie pokazuje kamień,
 * drugie (albo „Postaw”) go stawia. Pod ławką łatwo trafić w sąsiednie pole.
 */
export function PiecWRzedzie({ view, players, canMove, onMove }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const colorOf = (seat: 0 | 1) => players.find((p) => p.id === view.players[seat])?.color ?? "#8b8b92";
  const myColor = colorOf(view.turn);
  const win = new Set(view.winLine?.map((m) => m.y * view.size + m.x));
  const last = view.lastMove && view.lastMove.y * view.size + view.lastMove.x;
  const pickedFree = picked !== null && canMove && view.board[picked] === null ? picked : null;

  function place(i: number) {
    setPicked(null);
    onMove({ x: i % view.size, y: Math.floor(i / view.size) });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid aspect-square w-full gap-px overflow-hidden rounded-inset border border-line bg-line"
        style={{ gridTemplateColumns: `repeat(${view.size}, minmax(0, 1fr))` }}
      >
        {view.board.map((cell, i) => {
          const x = i % view.size;
          const y = Math.floor(i / view.size);
          const preview = pickedFree === i;
          return (
            <button
              key={i}
              type="button"
              disabled={!canMove || cell !== null}
              aria-label={`Pole ${x + 1}, ${y + 1}${cell === null ? "" : ", zajęte"}`}
              className={`relative grid place-items-center ${win.has(i) ? "bg-[color-mix(in_srgb,var(--color-accent)_28%,var(--color-surface-inset))]" : "bg-surface-inset"}`}
              onClick={() => (preview ? place(i) : setPicked(i))}
            >
              {(cell !== null || preview) && (
                <span
                  className={`size-[72%] rounded-full transition-opacity ${preview ? "opacity-40" : ""}`}
                  style={{ backgroundColor: cell === null ? myColor : colorOf(cell) }}
                />
              )}
              {last === i && <span className="absolute size-[22%] rounded-full bg-bg" aria-hidden />}
            </button>
          );
        })}
      </div>
      {canMove && (
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={pickedFree === null}
          onClick={() => pickedFree !== null && place(pickedFree)}
        >
          {pickedFree === null ? "Dotknij pola" : "Postaw"}
        </button>
      )}
    </div>
  );
}
