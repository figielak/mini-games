import { ArrowsClockwise, Check, Crosshair, Shuffle, X } from "@phosphor-icons/react";
import {
  isValidFleet,
  type LobbyPlayer,
  randomFleet,
  type Ship,
  shipCells,
  type Shot,
  STATKI_SIZE as SIZE,
  type StatkiView,
} from "@mini-games/games";
import { type ReactNode, useEffect, useState } from "react";

type Move = { type: "place"; ships: Ship[] } | { type: "ready" } | { type: "shoot"; x: number; y: number };

interface Props {
  view: StatkiView;
  me: string;
  players: LobbyPlayer[];
  canMove: boolean;
  onMove: (move: Move) => void;
}

const LETTERS = "ABCDEFGHIJ";
const at = (i: number) => ({ x: i % SIZE, y: Math.floor(i / SIZE) });
const shipAt = (ships: Ship[], x: number, y: number) =>
  ships.findIndex((s) => shipCells(s).some((c) => c.x === x && c.y === y));
const shotAt = (shots: Shot[], x: number, y: number) => shots.find((s) => s.x === x && s.y === y);
const mix = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--color-surface-inset))`;

export function Statki({ view, me, players, canMove, onMove }: Props) {
  const seated = view.players.includes(me);
  const enemyId = seated ? view.players.find((p) => p !== me)! : view.players[1];
  const ownId = seated ? me : view.players[0];
  const color = (id: string) => players.find((p) => p.id === id)?.color ?? "#8b8b92";
  const nick = (id: string) => players.find((p) => p.id === id)?.nick ?? "Gracz";

  if (view.phase === "placing" && seated) {
    return <Placement board={view.boards[me]} color={color(me)} onMove={onMove} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Battle
        title={seated ? `Plansza: ${nick(enemyId)}` : nick(enemyId)}
        board={view.boards[enemyId]}
        color={color(enemyId)}
        canShoot={canMove && view.phase === "battle"}
        onShoot={(x, y) => onMove({ type: "shoot", x, y })}
      />
      <div className={seated ? "mx-auto w-3/5" : ""}>
        <Battle title={seated ? "Twoja flota" : nick(ownId)} board={view.boards[ownId]} color={color(ownId)} compact={seated} />
      </div>
    </div>
  );
}

/** Rozstawianie: dotknij statku, żeby go zaznaczyć, potem pola, żeby go tam przenieść. */
function Placement({ board, color, onMove }: { board: StatkiView["boards"][string]; color: string; onMove: (m: Move) => void }) {
  const [ships, setShips] = useState(board.ships);
  const [selected, setSelected] = useState<number | null>(null);
  const [invalid, setInvalid] = useState(false);

  // Serwer jest źródłem prawdy: po „Losuj” albo odświeżeniu bierzemy jego ustawienie.
  useEffect(() => setShips(board.ships), [board.ships]);

  function commit(next: Ship[]) {
    if (!isValidFleet(next)) {
      setInvalid(true);
      setTimeout(() => setInvalid(false), 600);
      return;
    }
    setShips(next);
    onMove({ type: "place", ships: next });
  }

  function tap(x: number, y: number) {
    if (board.ready) return;
    const hit = shipAt(ships, x, y);
    // Inny statek: zaznacz go. Początek zaznaczonego: odznacz. Każde inne pole (także pod zaznaczonym): przenieś.
    if (hit !== -1 && hit !== selected) return setSelected(hit);
    if (selected === null) return;
    if (ships[selected].x === x && ships[selected].y === y) return setSelected(null);
    commit(ships.map((s, i) => (i === selected ? { ...s, x, y } : s)));
  }

  const selectedCells = new Set(selected === null ? [] : shipCells(ships[selected]).map((c) => c.y * SIZE + c.x));

  return (
    <div className="flex flex-col gap-3">
      <Grid
        label="Twoja flota"
        cell={(i) => {
          const { x, y } = at(i);
          const own = shipAt(ships, x, y) !== -1;
          const isSelected = selectedCells.has(i);
          return {
            style: own ? { backgroundColor: mix(color, isSelected ? 100 : 55) } : undefined,
            ring: isSelected && invalid,
          };
        }}
        onTap={board.ready ? undefined : tap}
      />
      {board.ready ? (
        <p className="text-center text-sm text-fg-muted">Gotowe. Czekamy na przeciwnika.</p>
      ) : (
        <>
          <p className="text-center text-sm text-fg-muted">
            {selected === null ? "Dotknij statku, żeby go przenieść." : "Dotknij pola, gdzie ma zacząć się statek."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={selected === null}
              onClick={() => selected !== null && commit(ships.map((s, i) => (i === selected ? { ...s, vertical: !s.vertical } : s)))}
            >
              <ArrowsClockwise size={18} aria-hidden />
              Obróć
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setSelected(null);
                commit(randomFleet(Math.random));
              }}
            >
              <Shuffle size={18} aria-hidden />
              Losuj
            </button>
          </div>
          <button type="button" className="btn btn-primary w-full" onClick={() => onMove({ type: "ready" })}>
            <Check size={18} weight="bold" aria-hidden />
            Gotowe
          </button>
        </>
      )}
    </div>
  );
}

/** Plansza w bitwie: statki (własne albo zatopione), trafienia, pudła i pola wokół zatopionych. */
function Battle({
  title,
  board,
  color,
  canShoot = false,
  compact = false,
  onShoot,
}: {
  title: string;
  board: StatkiView["boards"][string];
  color: string;
  canShoot?: boolean;
  compact?: boolean;
  onShoot?: (x: number, y: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const free = (i: number) => !shotAt(board.shots, at(i).x, at(i).y);
  const pickedFree = picked !== null && canShoot && free(picked) ? picked : null;

  function fire(i: number) {
    setPicked(null);
    onShoot?.(at(i).x, at(i).y);
  }

  return (
    <div className="flex flex-col gap-3">
      <Grid
        label={title}
        compact={compact}
        cell={(i) => {
          const { x, y } = at(i);
          const shot = shotAt(board.shots, x, y);
          const ship = shipAt(board.ships, x, y) !== -1;
          if (shot?.result === "hit") return { style: { backgroundColor: mix("var(--color-accent)", 70) }, content: <Mark /> };
          if (shot?.result === "sunk") return { style: { backgroundColor: mix("var(--color-accent)", 38) }, content: <Mark /> };
          if (shot?.result === "miss") return { content: <span className="size-1.5 rounded-full bg-fg-muted" /> };
          if (shot?.result === "around") return { content: <X size={compact ? 8 : 12} className="text-fg-subtle" aria-hidden /> };
          if (ship) return { style: { backgroundColor: mix(color, 55) } };
          return { ring: pickedFree === i };
        }}
        onTap={canShoot ? (x, y) => (pickedFree === y * SIZE + x ? fire(pickedFree) : setPicked(y * SIZE + x)) : undefined}
        disabled={(i) => !free(i)}
      />
      {canShoot && (
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={pickedFree === null}
          onClick={() => pickedFree !== null && fire(pickedFree)}
        >
          <Crosshair size={18} weight="bold" aria-hidden />
          {pickedFree === null ? "Wybierz pole" : `Strzel w ${LETTERS[at(pickedFree).x]}${at(pickedFree).y + 1}`}
        </button>
      )}
    </div>
  );
}

const Mark = () => <X size={14} weight="bold" className="text-fg" aria-hidden />;

/** Plansza 10×10 z opisami A-J nad i 1-10 z boku. */
function Grid({
  label,
  cell,
  onTap,
  disabled,
  compact = false,
}: {
  label: string;
  cell: (i: number) => { style?: React.CSSProperties; content?: ReactNode; ring?: boolean };
  onTap?: (x: number, y: number) => void;
  disabled?: (i: number) => boolean;
  compact?: boolean;
}) {
  const text = compact ? "text-[9px]" : "text-[11px]";
  return (
    <section aria-label={label}>
      <h2 className="label mb-2">{label}</h2>
      <div className="grid gap-px" style={{ gridTemplateColumns: `${compact ? "0.9rem" : "1.25rem"} repeat(${SIZE}, minmax(0, 1fr))` }}>
        <span />
        {LETTERS.split("").map((l) => (
          <span key={l} className={`text-center font-mono ${text} text-fg-muted`}>
            {l}
          </span>
        ))}
        {Array.from({ length: SIZE }, (_, y) => (
          <Row key={y} y={y} text={text} cell={cell} onTap={onTap} disabled={disabled} />
        ))}
      </div>
    </section>
  );
}

function Row({
  y,
  text,
  cell,
  onTap,
  disabled,
}: {
  y: number;
  text: string;
  cell: (i: number) => { style?: React.CSSProperties; content?: ReactNode; ring?: boolean };
  onTap?: (x: number, y: number) => void;
  disabled?: (i: number) => boolean;
}) {
  return (
    <>
      <span className={`flex items-center justify-center font-mono ${text} text-fg-muted`}>{y + 1}</span>
      {Array.from({ length: SIZE }, (_, x) => {
        const i = y * SIZE + x;
        const { style, content, ring } = cell(i);
        const name = `${LETTERS[x]}${y + 1}`;
        const className = `grid aspect-square place-items-center rounded-[3px] bg-surface-inset ${
          ring ? "outline-2 -outline-offset-2 outline-accent" : ""
        }`;
        return onTap ? (
          <button
            key={x}
            type="button"
            aria-label={name}
            className={className}
            style={style}
            disabled={disabled?.(i)}
            onClick={() => onTap(x, y)}
          >
            {content}
          </button>
        ) : (
          <span key={x} aria-label={name} className={className} style={style}>
            {content}
          </span>
        );
      })}
    </>
  );
}
