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
 * Przycisk leży tuż pod planszą; czekający widzi w tym samym miejscu, kto się zastanawia.
 */
export function PiecWRzedzie({ view, players, canMove, onMove }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const colorOf = (seat: 0 | 1) => players.find((p) => p.id === view.players[seat])?.color ?? "#8b8b92";
  const myColor = colorOf(view.turn);
  const turnNick = players.find((p) => p.id === view.players[view.turn])?.nick ?? "Przeciwnik";
  const over = view.winLine !== null || view.board.every((c) => c !== null);
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
      {/* Prawie cała szerokość ekranu: każdy piksel pola ułatwia celowanie palcem. Margines, żeby kamień nie dotykał ramki. */}
      <div className="-mx-3 rounded-inset border border-line bg-surface-inset p-1.5">
        <div className="relative">
        {/* Linie to obramowania pól, nie odstępy siatki: obramowanie ma zawsze równy piksel, odstęp przy ułamkowej szerokości pola nie. */}
        <div
          className="grid aspect-square w-full border-t border-l border-line"
          style={{ gridTemplate: `repeat(${view.size}, minmax(0, 1fr)) / repeat(${view.size}, minmax(0, 1fr))` }}
        >
          {view.board.map((cell, i) => {
            const x = i % view.size;
            const y = Math.floor(i / view.size);
            const preview = pickedFree === i;
            // Wiersz i kolumna wybranego pola: celownik na gęstej siatce. Neutralny i ledwo widoczny, żeby nie zlewał się z kamieniami.
            const cross = x === px || y === py;
            // Zwycięskie pola są przezroczyste i nad resztą: inaczej tła sąsiadów przycinają poświatę kamieni do prostokąta.
            const background = win.has(i) ? "transparent" : cross ? "color-mix(in srgb, var(--color-fg) 6%, var(--color-surface-inset))" : undefined;
            return (
              <button
                key={i}
                type="button"
                disabled={!canMove || cell !== null}
                aria-label={`Pole ${x + 1}, ${y + 1}${cell === null ? "" : ", zajęte"}`}
                className={`relative grid place-items-center border-r border-b border-line bg-surface-inset ${win.has(i) ? "z-10" : ""}`}
                style={{ background }}
                onClick={() => (preview ? place(i) : setPicked(i))}
              >
                {cell !== null ? (
                  <span
                    className={`aspect-square w-[80%] rounded-full ${last === i ? "animate-[stone-pop_0.35s_ease-out] outline-2 outline-offset-1 outline-fg" : ""}`}
                    style={{
                      background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${colorOf(cell)} 70%, white), ${colorOf(cell)} 65%)`,
                      boxShadow: win.has(i) ? `0 0 10px 2px ${colorOf(cell)}` : "0 1px 2px rgb(0 0 0 / 0.6)",
                    }}
                  />
                ) : preview ? (
                  // Jeszcze nie postawiony: stała, pełna obwódka i pulsujące wypełnienie.
                  <span className="grid aspect-square w-[80%] rounded-full border-2" style={{ borderColor: myColor }}>
                    <span className="animate-pulse rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${myColor} 55%, transparent)` }} />
                  </span>
                ) : (
                  STARS.has(i) && <span className="size-[14%] rounded-full bg-fg-subtle" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
        {ends && (
          <svg viewBox={`0 0 ${view.size} ${view.size}`} className="pointer-events-none absolute inset-0 z-20 size-full" aria-hidden>
            <line
              x1={ends[0].x + 0.5}
              y1={ends[0].y + 0.5}
              x2={ends[ends.length - 1].x + 0.5}
              y2={ends[ends.length - 1].y + 0.5}
              stroke="var(--color-fg)"
              strokeOpacity={0.85}
              strokeWidth={0.12}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              className="animate-[line-draw_0.5s_ease-out_backwards]"
            />
          </svg>
        )}
        </div>
      </div>

      {canMove ? (
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
      ) : (
        !over && (
          <p role="status" className="flex h-14 items-center justify-center gap-2 text-fg-muted">
            <span className="size-2.5 animate-pulse rounded-full" style={{ backgroundColor: myColor }} aria-hidden />
            {turnNick} się zastanawia…
          </p>
        )
      )}
    </div>
  );
}
