import { ArrowsClockwise, Check, Crosshair, Drop, Fire, Shuffle, Skull, X } from "@phosphor-icons/react";
import {
  FLEET_LENGTHS,
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
import { StickyBar } from "../screens/ui.tsx";

type Move = { type: "place"; ships: Ship[] } | { type: "ready" } | { type: "shoot"; x: number; y: number };
type Board = StatkiView["boards"][string];

interface Props {
  view: StatkiView;
  me: string;
  players: LobbyPlayer[];
  canMove: boolean;
  onMove: (move: Move) => void;
}

const LETTERS = "ABCDEFGHIJ";
const at = (i: number) => ({ x: i % SIZE, y: Math.floor(i / SIZE) });
const name = (s: { x: number; y: number }) => `${LETTERS[s.x]}${s.y + 1}`;
const shipAt = (ships: Ship[], x: number, y: number) =>
  ships.findIndex((s) => shipCells(s).some((c) => c.x === x && c.y === y));
const shotAt = (shots: Shot[], x: number, y: number) => shots.find((s) => s.x === x && s.y === y);
const isSunk = (ship: Ship, shots: Shot[]) => shipCells(ship).every((c) => shotAt(shots, c.x, c.y)?.result === "sunk");
const mix = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--color-surface-inset))`;
/** Ostatni prawdziwy strzał: pola „around” są dopisywane po zatopieniu, a „hit” zmienia się w „sunk” w miejscu. */
const lastShot = (shots: Shot[]) => shots.findLast((s) => s.result !== "around");

export function Statki({ view, me, players, canMove, onMove }: Props) {
  const seated = view.players.includes(me);
  const enemyId = seated ? view.players.find((p) => p !== me)! : view.players[1];
  const ownId = seated ? me : view.players[0];
  const color = (id: string) => players.find((p) => p.id === id)?.color ?? "#8b8b92";
  const nick = (id: string) => players.find((p) => p.id === id)?.nick ?? "Gracz";

  if (view.phase === "placing" && seated) {
    return <Placement board={view.boards[me]} color={color(me)} onMove={onMove} />;
  }

  // W turze przeciwnika liczy się własna flota: idzie na górę, duża, z komunikatem tuż nad nią.
  const defending = seated && view.phase === "battle" && view.shooter === enemyId;
  const incoming = seated ? lastShot(view.boards[me].shots) : undefined;
  const spot = incoming && name(incoming);
  const news =
    incoming &&
    (incoming.result === "miss"
      ? { icon: <Drop size={18} weight="fill" aria-hidden />, text: `${nick(enemyId)} pudłuje (${spot})` }
      : incoming.result === "hit"
        ? { icon: <Fire size={18} weight="fill" aria-hidden />, text: `${nick(enemyId)} trafia w ${spot}!` }
        : { icon: <Skull size={20} weight="fill" aria-hidden />, text: `${nick(enemyId)} zatapia twój statek (${spot})!`, loud: true });

  const enemy = (
    <Battle
      key="enemy"
      title={seated ? `Plansza: ${nick(enemyId)}` : nick(enemyId)}
      board={view.boards[enemyId]}
      color={color(enemyId)}
      shooterColor={color(me)}
      canShoot={canMove && view.phase === "battle"}
      compact={defending}
      onShoot={(x, y) => onMove({ type: "shoot", x, y })}
    />
  );
  const own = (
    <div key="own" className="flex flex-col gap-2">
      {news && (
        <p
          className={`flex items-center justify-center gap-2 ${news.loud ? "text-base font-semibold" : "text-sm font-medium"}`}
          style={{ color: color(enemyId) }}
          role="status"
        >
          {news.icon}
          {news.text}
        </p>
      )}
      <Battle
        title={seated ? "Twoja flota" : nick(ownId)}
        board={view.boards[ownId]}
        color={color(ownId)}
        last={incoming}
        compact={seated && !defending}
      />
    </div>
  );
  const small = (node: ReactNode, key: string) => (
    <div key={key} className={seated ? "mx-auto w-3/5" : ""}>
      {node}
    </div>
  );

  return <div className="flex flex-col gap-4">{defending ? [own, small(enemy, "s-enemy")] : [enemy, small(own, "s-own")]}</div>;
}

/** Pozostała flota w nagłówku: pasek na każdy statek, zatopione wygaszone. */
export function FleetLeft({ board, color }: { board: Board; color: string }) {
  const sunk = board.ships.filter((s) => isSunk(s, board.shots)).map((s) => s.length);
  return (
    <span className="ml-2 flex flex-1 items-center gap-1" aria-label={`Statki na wodzie: ${FLEET_LENGTHS.length - sunk.length} z ${FLEET_LENGTHS.length}`}>
      {FLEET_LENGTHS.map((length, i) => {
        const k = sunk.indexOf(length);
        if (k !== -1) sunk.splice(k, 1);
        return (
          <span
            key={i}
            className={`h-2 basis-0 rounded-full ${k !== -1 ? "opacity-25" : ""}`}
            style={{ flexGrow: length, backgroundColor: color }}
            aria-hidden
          />
        );
      })}
    </span>
  );
}

/** Rozstawianie: dotknij statku, żeby go zaznaczyć, potem pola, żeby go tam przenieść. */
function Placement({ board, color, onMove }: { board: Board; color: string; onMove: (m: Move) => void }) {
  const [ships, setShips] = useState(board.ships);
  const [selected, setSelected] = useState<number | null>(null);
  // Niedozwolona pozycja: przez chwilę czerwony obrys tam, gdzie statek miał stanąć.
  const [ghost, setGhost] = useState<Ship | null>(null);

  // Serwer jest źródłem prawdy: po „Losuj” albo odświeżeniu bierzemy jego ustawienie.
  useEffect(() => setShips(board.ships), [board.ships]);

  function commit(next: Ship[]) {
    if (!isValidFleet(next)) {
      if (selected !== null) setGhost(next[selected]);
      setTimeout(() => setGhost(null), 600);
      return;
    }
    setGhost(null);
    setShips(next);
    onMove({ type: "place", ships: next });
  }

  const moved = (x: number, y: number) => ships.map((s, i) => (i === selected ? { ...s, x, y } : s));

  function tap(x: number, y: number) {
    if (board.ready) return;
    const hit = shipAt(ships, x, y);
    // Inny statek: zaznacz go. Początek zaznaczonego: odznacz. Każde inne pole (także pod zaznaczonym): przenieś.
    if (hit !== -1 && hit !== selected) return setSelected(hit);
    if (selected === null) return;
    if (ships[selected].x === x && ships[selected].y === y) return setSelected(null);
    commit(moved(x, y));
  }

  // Pola, na które można przenieść początek zaznaczonego statku.
  const targets = new Set<number>();
  if (selected !== null) for (let i = 0; i < SIZE * SIZE; i++) if (isValidFleet(moved(at(i).x, at(i).y))) targets.add(i);

  const shapes: Shape[] = ships.map((ship, i) => ({ ship, color: mix(color, i === selected ? 100 : 55), outline: i === selected }));
  if (ghost) shapes.push({ ship: ghost, color: "color-mix(in srgb, var(--color-accent) 55%, transparent)" });

  return (
    <div className="flex flex-col gap-3">
      <Grid
        label="Twoja flota"
        shapes={shapes}
        cell={(i) => ({ background: targets.has(i) ? mix(color, 18) : undefined })}
        onTap={board.ready ? undefined : tap}
      />
      {board.ready ? (
        <p className="text-center text-sm text-fg-muted">Gotowe. Czekamy na przeciwnika.</p>
      ) : (
        <>
          <p className="text-center text-sm text-fg-muted">
            {selected === null ? "Dotknij statku, żeby go przenieść." : "Dotknij podświetlonego pola, gdzie ma zacząć się statek."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-ghost disabled:opacity-70"
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
          <StickyBar>
            <button
              type="button"
              className="btn h-14 w-full text-lg font-semibold text-bg"
              style={{ backgroundColor: color }}
              onClick={() => onMove({ type: "ready" })}
            >
              <Check size={20} weight="bold" aria-hidden />
              Gotowe
            </button>
          </StickyBar>
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
  shooterColor,
  last,
  canShoot = false,
  compact = false,
  onShoot,
}: {
  title: string;
  board: Board;
  color: string;
  shooterColor?: string;
  last?: Shot;
  canShoot?: boolean;
  compact?: boolean;
  onShoot?: (x: number, y: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const free = (i: number) => !shotAt(board.shots, at(i).x, at(i).y);
  const pickedFree = picked !== null && canShoot && free(picked) ? picked : null;
  const lastIndex = last && last.y * SIZE + last.x;

  function fire(i: number) {
    setPicked(null);
    onShoot?.(at(i).x, at(i).y);
  }

  return (
    <div className="flex flex-col gap-3">
      <Grid
        label={title}
        compact={compact}
        // Zatopiony: jeden ciemnoczerwony kształt. Pozostałe (tylko własne): w kolorze gracza.
        shapes={board.ships.map((ship) => ({ ship, color: isSunk(ship, board.shots) ? mix("var(--color-accent)", 50) : mix(color, 55) }))}
        cell={(i) => {
          const { x, y } = at(i);
          const shot = shotAt(board.shots, x, y);
          const ring = pickedFree === i || lastIndex === i;
          if (shot?.result === "hit") return { background: "var(--color-accent)", ring };
          if (shot?.result === "miss") return { content: <span className="size-1.5 rounded-full bg-fg-muted" />, ring };
          // Pole wykluczone wokół zatopionego: przygaszony ×. Trafienie to samo czerwone pole, więc × ma jedno znaczenie.
          if (shot?.result === "around") return { content: <X size={compact ? 8 : 12} className="text-fg-subtle" aria-hidden /> };
          return { ring };
        }}
        onTap={canShoot ? (x, y) => (pickedFree === y * SIZE + x ? fire(pickedFree) : setPicked(y * SIZE + x)) : undefined}
        disabled={(i) => !free(i)}
      />
      {canShoot && (
        <StickyBar>
          <button
            type="button"
            className="btn h-14 w-full text-lg font-semibold text-bg disabled:opacity-40"
            style={{ backgroundColor: shooterColor }}
            disabled={pickedFree === null}
            onClick={() => pickedFree !== null && fire(pickedFree)}
          >
            <Crosshair size={20} weight="bold" aria-hidden />
            {pickedFree === null ? "Wybierz pole" : `Strzel w ${name(at(pickedFree))}`}
          </button>
        </StickyBar>
      )}
    </div>
  );
}

type Shape = { ship: Ship; color: string; outline?: boolean };

/**
 * Plansza 10×10 z opisami A-J nad i 1-10 z boku. Statki to kształty pod polami (jeden zaokrąglony prostokąt
 * na statek), a pola nad nimi są przezroczyste. Dlatego wszystko ma jawne miejsce w siatce: auto-placement
 * omijałby komórki zajęte przez kształty.
 */
function Grid({
  label,
  cell,
  shapes,
  onTap,
  disabled,
  compact = false,
}: {
  label: string;
  cell: (i: number) => { background?: string; content?: ReactNode; ring?: boolean };
  shapes: Shape[];
  onTap?: (x: number, y: number) => void;
  disabled?: (i: number) => boolean;
  compact?: boolean;
}) {
  const text = `font-mono ${compact ? "text-[9px]" : "text-[11px]"} text-fg-muted`;
  const covered = new Set(shapes.flatMap((s) => shipCells(s.ship).map((c) => c.y * SIZE + c.x)));
  return (
    <section aria-label={label}>
      <h2 className="label mb-2">{label}</h2>
      <div className="grid gap-px" style={{ gridTemplateColumns: `${compact ? "0.9rem" : "1.25rem"} repeat(${SIZE}, minmax(0, 1fr))` }}>
        {Array.from({ length: SIZE }, (_, k) => (
          <span key={`c${k}`} className={`text-center ${text}`} style={{ gridColumn: k + 2, gridRow: 1 }}>
            {LETTERS[k]}
          </span>
        ))}
        {Array.from({ length: SIZE }, (_, k) => (
          <span key={`r${k}`} className={`flex items-center justify-center ${text}`} style={{ gridColumn: 1, gridRow: k + 2 }}>
            {k + 1}
          </span>
        ))}
        {shapes.map(({ ship, color, outline }, k) => {
          // Duch niedozwolonej pozycji może wystawać poza planszę: przycinamy, żeby siatka nie dostała nowych kolumn.
          const span = Math.min(ship.length, SIZE - (ship.vertical ? ship.y : ship.x));
          return (
            <span
              key={`s${k}`}
              className={`pointer-events-none rounded-md transition-colors ${outline ? "outline-2 -outline-offset-2 outline-fg" : ""}`}
              style={{
                gridColumn: `${ship.x + 2} / span ${ship.vertical ? 1 : span}`,
                gridRow: `${ship.y + 2} / span ${ship.vertical ? span : 1}`,
                backgroundColor: color,
              }}
              aria-hidden
            />
          );
        })}
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const { x, y } = at(i);
          const { background, content, ring } = cell(i);
          const style = {
            gridColumn: x + 2,
            gridRow: y + 2,
            background: background ?? (covered.has(i) ? "transparent" : undefined),
          };
          const className = `grid aspect-square place-items-center rounded-[3px] bg-surface-inset ${
            ring ? "outline-2 -outline-offset-2 outline-fg" : ""
          }`;
          return onTap ? (
            <button
              key={i}
              type="button"
              aria-label={name({ x, y })}
              className={className}
              style={style}
              disabled={disabled?.(i)}
              onClick={() => onTap(x, y)}
            >
              {content}
            </button>
          ) : (
            <span key={i} aria-label={name({ x, y })} className={className} style={style}>
              {content}
            </span>
          );
        })}
      </div>
    </section>
  );
}
