import type { LobbyPlayer, PiecWRzedzieView } from "@mini-games/games";
import { useState } from "react";
import { StickyBar } from "../screens/ui.tsx";

interface Props {
  view: PiecWRzedzieView;
  players: LobbyPlayer[];
  canMove: boolean;
  onMove: (move: { x: number; y: number }) => void;
}

/** Punkty orientacyjne jak na planszy do go: środek i cztery wokół. */
const STARS = new Set([3 * 15 + 3, 3 * 15 + 11, 7 * 15 + 7, 11 * 15 + 3, 11 * 15 + 11]);

/**
 * Pole ma ~25px na telefonie, więc ruch idzie w dwóch krokach: pierwsze dotknięcie pokazuje kamień,
 * drugie (albo „Postaw”) go stawia. Pod ławką łatwo trafić w sąsiednie pole.
 */
export function PiecWRzedzie({ view, players, canMove, onMove }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const colorOf = (seat: 0 | 1) => players.find((p) => p.id === view.players[seat])?.color ?? "#8b8b92";
  const myColor = colorOf(view.turn);
  const win = new Set(view.winLine?.map((m) => m.y * view.size + m.x));
  // Końce zwycięskiej linii: po sortowaniu (x, y) skrajne pola w każdym kierunku.
  const ends = view.winLine && [...view.winLine].sort((a, b) => a.x - b.x || a.y - b.y);
  const last = view.lastMove && view.lastMove.y * view.size + view.lastMove.x;
  const pickedFree = picked !== null && canMove && view.board[picked] === null ? picked : null;
  const px = pickedFree === null ? null : pickedFree % view.size;
  const py = pickedFree === null ? null : Math.floor(pickedFree / view.size);

  function place(i: number) {
    setPicked(null);
    onMove({ x: i % view.size, y: Math.floor(i / view.size) });
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Prawie cała szerokość ekranu: każdy piksel pola ułatwia celowanie palcem. */}
      <div className="relative -mx-3">
        <div
          className="grid aspect-square w-full gap-px overflow-hidden rounded-inset border border-line bg-line"
          style={{ gridTemplate: `repeat(${view.size}, minmax(0, 1fr)) / repeat(${view.size}, minmax(0, 1fr))` }}
        >
          {view.board.map((cell, i) => {
            const x = i % view.size;
            const y = Math.floor(i / view.size);
            const preview = pickedFree === i;
            // Wiersz i kolumna wybranego pola: celownik na gęstej siatce.
            const cross = x === px || y === py;
            const background = win.has(i)
              ? `color-mix(in srgb, ${colorOf(cell!)} 28%, var(--color-surface-inset))`
              : cross
                ? `color-mix(in srgb, ${myColor} 14%, var(--color-surface-inset))`
                : undefined;
            return (
              <button
                key={i}
                type="button"
                disabled={!canMove || cell !== null}
                aria-label={`Pole ${x + 1}, ${y + 1}${cell === null ? "" : ", zajęte"}`}
                className="relative grid place-items-center bg-surface-inset"
                style={{ background }}
                onClick={() => (preview ? place(i) : setPicked(i))}
              >
                {cell !== null ? (
                  <span
                    className={`aspect-square w-[72%] rounded-full ${last === i ? "animate-[stone-pop_0.35s_ease-out] outline-2 outline-offset-2 outline-fg" : ""}`}
                    style={{ backgroundColor: colorOf(cell), boxShadow: win.has(i) ? `0 0 10px 2px ${colorOf(cell)}` : undefined }}
                  />
                ) : preview ? (
                  // Jeszcze nie postawiony: półprzezroczysty, z pełną obwódką i pulsem.
                  <span
                    className="aspect-square w-[72%] animate-pulse rounded-full border-2"
                    style={{ borderColor: myColor, backgroundColor: `color-mix(in srgb, ${myColor} 45%, transparent)` }}
                  />
                ) : (
                  STARS.has(i) && <span className="size-[18%] rounded-full bg-fg-muted" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
        {ends && (
          <svg viewBox={`0 0 ${view.size} ${view.size}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            <line
              x1={ends[0].x + 0.5}
              y1={ends[0].y + 0.5}
              x2={ends[ends.length - 1].x + 0.5}
              y2={ends[ends.length - 1].y + 0.5}
              stroke="var(--color-fg)"
              strokeWidth={0.18}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 0.3px var(--color-fg))" }}
            />
          </svg>
        )}
      </div>

      {/* Odstęp spycha przycisk na dół ekranu, pod kciuk (jak w Chińczyku). */}
      <span className="-mt-3 flex-1" aria-hidden />

      {canMove && (
        <StickyBar>
          <button
            type="button"
            className="btn h-14 w-full text-lg font-semibold text-bg disabled:opacity-40"
            style={{ backgroundColor: myColor }}
            disabled={pickedFree === null}
            onClick={() => pickedFree !== null && place(pickedFree)}
          >
            {pickedFree === null ? "Wybierz pole" : "Postaw"}
          </button>
        </StickyBar>
      )}
    </div>
  );
}
