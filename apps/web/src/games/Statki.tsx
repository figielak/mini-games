import { ArrowCounterClockwise, ArrowsClockwise, Check, Crosshair, Drop, Fire, Shuffle, Skull, X } from "@phosphor-icons/react";
import {
  isValidFleet,
  type LobbyPlayer,
  randomFleet,
  type Ship,
  shipAround,
  shipCells,
  type Shot,
  STATKI_MODES,
  type StatkiRules as Rules,
  type StatkiView,
} from "@mini-games/games";
import { type CSSProperties, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { StickyBar } from "../screens/ui.tsx";

type Move = { type: "place"; ships: Ship[] } | { type: "ready" } | { type: "unready" } | { type: "shoot"; x: number; y: number };
type Board = StatkiView["boards"][string];

interface Props {
  view: StatkiView;
  me: string;
  players: LobbyPlayer[];
  canMove: boolean;
  onMove: (move: Move) => void;
}

const LETTERS = "ABCDEFGHIJKL";
/** Indeks pola na planszy danego rozmiaru zamieniony na współrzędne. */
const cellAt = (size: number) => (i: number) => ({ x: i % size, y: Math.floor(i / size) });
const name = (s: { x: number; y: number }) => `${LETTERS[s.x]}${s.y + 1}`;
const shipAt = (ships: Ship[], x: number, y: number) =>
  ships.findIndex((s) => shipCells(s).some((c) => c.x === x && c.y === y));
const shotAt = (shots: Shot[], x: number, y: number) => shots.find((s) => s.x === x && s.y === y);
const isSunk = (ship: Ship, shots: Shot[]) => shipCells(ship).every((c) => shotAt(shots, c.x, c.y)?.result === "sunk");
/**
 * Statek: półprzezroczyste wypełnienie i obrys w pełnym kolorze. Sam przyciemniony kolor robił z żółtego oliwkowy.
 * `solid`: zaznaczony albo przeciągany, pełny kolor z poświatą.
 */
const hull = (color: string, solid = false): CSSProperties => ({
  backgroundColor: solid ? color : `color-mix(in srgb, ${color} 30%, transparent)`,
  border: `2px solid ${color}`,
  boxShadow: solid ? `0 0 12px ${color}` : undefined,
});
/** Tyle po pudle zostaje stary układ plansz: obaj mają zobaczyć, gdzie padł strzał, zanim plansze się zamienią. */
const SWAP_MS = 1200;
const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Ostatni prawdziwy strzał: pola „around” są dopisywane po zatopieniu, a „hit” zmienia się w „sunk” w miejscu. */
const lastShot = (shots: Shot[]) => shots.findLast((s) => s.result !== "around");

export function Statki({ view, me, players, canMove, onMove }: Props) {
  const seated = view.players.includes(me);
  const enemyId = seated ? view.players.find((p) => p !== me)! : view.players[1];
  const ownId = seated ? me : view.players[0];
  const color = (id: string) => players.find((p) => p.id === id)?.color ?? "#8b8b92";
  const nick = (id: string) => players.find((p) => p.id === id)?.nick ?? "Gracz";
  const rules = STATKI_MODES.find((m) => m.id === view.mode) ?? STATKI_MODES[0];

  // W turze przeciwnika liczy się własna flota: idzie na górę, duża, z komunikatem tuż nad nią.
  const turn = seated && view.phase === "battle" && view.shooter === enemyId;
  // Układ goni stan: zamiana plansz to view transition, w którym duża i mała plansza przelatują na swoje miejsca.
  const [defending, setDefending] = useState(turn);
  // Tura przechodzi w bitwie tylko po pudle; start bitwy i koniec partii zamieniają układ od razu.
  const afterMiss = view.phase === "battle" && view.players.some((p) => view.boards[p].shots.length > 0);
  useEffect(() => {
    if (turn === defending) return;
    const swap = () => {
      if (reducedMotion || !document.startViewTransition) return setDefending(turn);
      document.startViewTransition(() => flushSync(() => setDefending(turn)));
    };
    if (!afterMiss) return swap();
    const id = setTimeout(swap, SWAP_MS);
    return () => clearTimeout(id);
  }, [turn]);

  if (view.phase === "placing" && seated) {
    return <Placement rules={rules} board={view.boards[me]} color={color(me)} enemyNick={nick(enemyId)} onMove={onMove} />;
  }

  const incoming = seated ? lastShot(view.boards[me].shots) : undefined;
  const spot = incoming && name(incoming);
  const news =
    incoming &&
    (incoming.result === "miss"
      ? { icon: <Drop size={18} weight="fill" aria-hidden />, text: `Pudło! ${nick(enemyId)} → ${spot}` }
      : incoming.result === "hit"
        ? { icon: <Fire size={18} weight="fill" aria-hidden />, text: `Trafienie! ${nick(enemyId)} → ${spot}` }
        : { icon: <Skull size={20} weight="fill" aria-hidden />, text: `Zatopiony! ${nick(enemyId)} → ${spot}`, loud: true });

  const enemy = (
    <Battle
      key="enemy"
      rules={rules}
      title={seated ? `Cel: ${nick(enemyId)}` : nick(enemyId)}
      vt="statki-enemy"
      board={view.boards[enemyId]}
      color={color(enemyId)}
      shooterColor={color(me)}
      // Strzelać można dopiero po zamianie plansz: wcześniej cel jest jeszcze miniaturą.
      canShoot={canMove && view.phase === "battle" && !defending}
      compact={defending}
      onShoot={(x, y) => onMove({ type: "shoot", x, y })}
    />
  );
  const own = (
    <div key="own">
      <Battle
        rules={rules}
        title={seated ? "Twoja flota" : nick(ownId)}
        vt="statki-own"
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

  // Komunikat o ostatnim strzale przeciwnika zawsze nad dużą planszą, niezależnie od układu.
  return (
    <div className="flex flex-col gap-4">
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
      {defending ? [own, small(enemy, "s-enemy")] : [enemy, small(own, "s-own")]}
    </div>
  );
}

/**
 * Flota w nagłówku: sylwetka każdego statku (kwadracik na pole). Zatopione wygaszone i przekreślone.
 * Trafione segmenty na czerwono tylko tam, gdzie widać całą flotę (własna): u przeciwnika nie wiadomo, czyj to segment.
 */
export function FleetLeft({ board, color, lengths: all }: { board: Board; color: string; lengths: number[] }) {
  const hit = (c: { x: number; y: number }) => shotAt(board.shots, c.x, c.y) !== undefined;
  const known = board.ships.map((s) => ({ sunk: isSunk(s, board.shots), hits: shipCells(s).map(hit) }));
  // Widok przeciwnika ma tylko zatopione statki: reszta floty to nietknięte sylwetki.
  const lengths = known.map((k) => k.hits.length);
  const rest = all.filter((length) => {
    const k = lengths.indexOf(length);
    return k === -1 || !lengths.splice(k, 1);
  });
  const fleet = [...known, ...rest.map((length) => ({ sunk: false, hits: Array<boolean>(length).fill(false) }))].sort(
    (a, b) => b.hits.length - a.hits.length,
  );
  const afloat = fleet.filter((f) => !f.sunk).length;
  return (
    <span className="ml-2 flex flex-1 flex-wrap items-center justify-end gap-1" aria-label={`Statki na wodzie: ${afloat} z ${fleet.length}`}>
      {fleet.map((ship, i) => (
        <span key={i} className={`relative flex gap-px ${ship.sunk ? "opacity-40" : ""}`} aria-hidden>
          {ship.hits.map((h, j) => (
            <span key={j} className="size-1.5 rounded-[1px]" style={{ backgroundColor: h ? RED : color }} />
          ))}
          {ship.sunk && <span className="absolute inset-x-[-1px] top-1/2 h-px bg-fg" />}
        </span>
      ))}
    </span>
  );
}

const RED = "var(--color-accent)";

/** Rozstawianie: przeciągnij statek albo dotknij go, a potem pola, gdzie ma się zaczynać. */
function Placement({
  rules,
  board,
  color,
  enemyNick,
  onMove,
}: {
  rules: Rules;
  board: Board;
  color: string;
  enemyNick: string;
  onMove: (m: Move) => void;
}) {
  const SIZE = rules.size;
  const at = cellAt(SIZE);
  const label = `Twoja flota · ${rules.name}`;
  const [ships, setShips] = useState(board.ships);
  const [selected, setSelected] = useState<number | null>(null);
  // Niedozwolona pozycja: przez chwilę czerwony statek tam, gdzie miał stanąć.
  const [ghost, setGhost] = useState<Ship | null>(null);
  // Przeciągany statek w miejscu pod palcem (jeszcze niezatwierdzony).
  const [drag, setDrag] = useState<{ index: number; ship: Ship } | null>(null);
  // Chwycony statek i segment; przeciąganie zaczyna się dopiero po wyjściu z chwyconego pola.
  const grab = useRef<{ index: number; dx: number; dy: number; cell: number } | null>(null);
  // Po przeciągnięciu przeglądarka może jeszcze wysłać click: nie jest dotknięciem.
  const dragged = useRef(false);

  // Serwer jest źródłem prawdy: po „Losuj” albo odświeżeniu bierzemy jego ustawienie.
  useEffect(() => setShips(board.ships), [board.ships]);

  const replaced = (index: number, ship: Ship) => ships.map((s, i) => (i === index ? ship : s));

  function commit(next: Ship[], index?: number) {
    if (!isValidFleet(next, rules)) {
      navigator.vibrate?.(60);
      if (index !== undefined) setGhost(next[index]);
      setTimeout(() => setGhost(null), 600);
      return;
    }
    setGhost(null);
    setShips(next);
    onMove({ type: "place", ships: next });
  }

  function tap(x: number, y: number) {
    if (dragged.current) return;
    const hit = shipAt(ships, x, y);
    // Inny statek: zaznacz go. Początek zaznaczonego: odznacz. Każde inne pole (także pod zaznaczonym): przenieś.
    if (hit !== -1 && hit !== selected) return setSelected(hit);
    if (selected === null) return;
    if (ships[selected].x === x && ships[selected].y === y) return setSelected(null);
    commit(replaced(selected, { ...ships[selected], x, y }), selected);
  }

  const pointer = {
    down(i: number | null) {
      dragged.current = false;
      const hit = i === null ? -1 : shipAt(ships, at(i).x, at(i).y);
      grab.current = hit === -1 ? null : { index: hit, dx: at(i!).x - ships[hit].x, dy: at(i!).y - ships[hit].y, cell: i! };
    },
    /** Zwraca true, gdy trwa przeciąganie (plansza przejmuje wtedy wskaźnik). */
    move(i: number | null) {
      const g = grab.current;
      if (!g || i === null || (!dragged.current && i === g.cell)) return dragged.current;
      const ship = ships[g.index];
      // Statek zostaje na planszy, nawet gdy palec wyjedzie nim za krawędź.
      const clamp = (v: number, long: boolean) => Math.max(0, Math.min(SIZE - (long ? ship.length : 1), v));
      dragged.current = true;
      setDrag({ index: g.index, ship: { ...ship, x: clamp(at(i).x - g.dx, !ship.vertical), y: clamp(at(i).y - g.dy, ship.vertical) } });
      return true;
    },
    up(cancel = false) {
      if (drag && !cancel) {
        commit(replaced(drag.index, drag.ship), drag.index);
        setSelected(drag.index);
      }
      grab.current = null;
      setDrag(null);
    },
  };

  const shown = drag ? replaced(drag.index, drag.ship) : ships;
  const active = drag?.index ?? selected;
  // Strefa zakazana: pola wokół pozostałych statków, gdzie ruszany statek nie może stanąć. W trybie ze stykaniem jej nie ma.
  const others = active === null || rules.touching ? [] : shown.filter((_, i) => i !== active);
  const blocked = new Set(others.flatMap((s) => shipAround(s, SIZE)).map((c) => c.y * SIZE + c.x));

  const shapes: Shape[] = shown.map((ship, i) => ({
    ship,
    style: drag?.index === i && !isValidFleet(shown, rules) ? hull(RED, true) : hull(color, i === active),
    outline: i === active,
  }));
  if (ghost) shapes.push({ ship: ghost, style: hull(RED, true) });

  if (board.ready) {
    return (
      <div className="flex flex-col gap-3">
        <Grid size={SIZE} label={label} color={color} shapes={ships.map((ship) => ({ ship, style: hull(color) }))} cell={() => ({})} />
        <p role="status" className="flex items-center justify-center gap-2 text-center text-sm text-fg-muted">
          <span className="size-2.5 animate-pulse rounded-full" style={{ backgroundColor: color }} aria-hidden />
          Czekamy, aż {enemyNick} ustawi flotę…
        </p>
        <button type="button" className="btn btn-ghost" onClick={() => onMove({ type: "unready" })}>
          <ArrowCounterClockwise size={18} aria-hidden />
          Zmień ustawienie
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Grid
        size={SIZE}
        label={label}
        color={color}
        shapes={shapes}
        cell={(i) => ({ background: blocked.has(i) ? "var(--color-accent-soft)" : undefined })}
        onTap={tap}
        pointer={pointer}
      />
      <p className="text-center text-sm text-fg-muted">
        {selected === null ? "Przeciągnij statek albo dotknij go, żeby przenieść." : `Dotknij pola, gdzie ma zacząć się statek.${rules.touching ? "" : " Czerwone pola są za blisko innych."}`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={selected === null}
          onClick={() => selected !== null && commit(replaced(selected, { ...ships[selected], vertical: !ships[selected].vertical }), selected)}
        >
          <ArrowsClockwise size={18} aria-hidden />
          Obróć
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setSelected(null);
            commit(randomFleet(Math.random, rules));
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
          onClick={() => {
            setSelected(null);
            onMove({ type: "ready" });
          }}
        >
          <Check size={20} weight="bold" aria-hidden />
          Gotowe
        </button>
      </StickyBar>
    </div>
  );
}

/** Plansza w bitwie: statki (własne albo zatopione), trafienia, pudła i pola wokół zatopionych. */
function Battle({
  rules,
  title,
  board,
  color,
  shooterColor,
  last,
  vt,
  canShoot = false,
  compact = false,
  onShoot,
}: {
  rules: Rules;
  title: string;
  board: Board;
  color: string;
  shooterColor?: string;
  last?: Shot;
  vt?: string;
  canShoot?: boolean;
  compact?: boolean;
  onShoot?: (x: number, y: number) => void;
}) {
  const SIZE = rules.size;
  const at = cellAt(SIZE);
  const [picked, setPicked] = useState<number | null>(null);
  const free = (i: number) => !shotAt(board.shots, at(i).x, at(i).y);
  const pickedFree = picked !== null && canShoot && free(picked) ? picked : null;
  const lastIndex = last && last.y * SIZE + last.x;
  // Najświeższy strzał w tę planszę wskakuje na pole: widać, gdzie padł, nie tylko w tekście.
  const fresh = lastShot(board.shots);
  const pop = (i: number) => (fresh && fresh.y * SIZE + fresh.x === i ? "animate-[stone-pop_0.35s_ease-out]" : "");

  function fire(i: number) {
    setPicked(null);
    onShoot?.(at(i).x, at(i).y);
  }

  return (
    <div className="flex flex-col gap-3">
      <Grid
        size={SIZE}
        label={title}
        color={color}
        vt={vt}
        cross={pickedFree}
        compact={compact}
        // Zatopiony: czerwony kształt. Pozostałe (tylko własne): w kolorze gracza.
        shapes={board.ships.map((ship) => ({ ship, style: hull(isSunk(ship, board.shots) ? RED : color) }))}
        cell={(i) => {
          const { x, y } = at(i);
          const shot = shotAt(board.shots, x, y);
          const ring = pickedFree === i || lastIndex === i;
          // Trafienie to płomień, pudło to kropka: różnią się kształtem, a płomień nie krzyczy tak jak pełne czerwone pole.
          if (shot?.result === "hit") return { content: <Fire size={compact ? 10 : 18} weight="fill" className={`text-accent ${pop(i)}`} aria-hidden />, ring };
          if (shot?.result === "miss") return { content: <span className={`size-1.5 rounded-full bg-fg-muted ${pop(i)}`} />, ring };
          // Pole wykluczone wokół zatopionego: przygaszony ×.
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

type Shape = { ship: Ship; style: CSSProperties; outline?: boolean };

/** Pole planszy pod wskaźnikiem (także gdy wskaźnik jest przechwycony przez planszę). */
const cellUnder = (e: PointerEvent) => {
  const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell]")?.dataset.cell;
  return cell === undefined ? null : Number(cell);
};

/**
 * Plansza (10×10 albo 12×12, zależnie od trybu) w ramce, z opisami liter nad i liczb z boku. Statki to kształty pod polami (jeden zaokrąglony prostokąt
 * na statek), a pola nad nimi są przezroczyste, więc ich linie dzielą statek na segmenty. Wszystko ma jawne miejsce
 * w siatce: auto-placement omijałby komórki zajęte przez kształty.
 * Linie to obramowania pól, nie odstępy siatki (jak w Gomoku): mają zawsze równy piksel.
 */
function Grid({
  size: SIZE,
  label,
  cell,
  shapes,
  onTap,
  pointer,
  disabled,
  color,
  vt,
  cross = null,
  compact = false,
}: {
  size: number;
  label: string;
  /** Kolor właściciela planszy: nagłówek od razu mówi, czyja to plansza. */
  color: string;
  /** Nazwa view transition: plansza przelatuje między dużym i małym miejscem. */
  vt?: string;
  /** Wybrane pole: celownik z wiersza i kolumny (jak w Gomoku) i pogrubione opisy osi. */
  cross?: number | null;
  cell: (i: number) => { background?: string; content?: ReactNode; ring?: boolean };
  shapes: Shape[];
  onTap?: (x: number, y: number) => void;
  /** Przeciąganie (rozstawianie): pole pod wskaźnikiem; `move` zwraca true, gdy plansza ma przejąć wskaźnik. */
  pointer?: { down: (i: number | null) => void; move: (i: number | null) => boolean; up: (cancel?: boolean) => void };
  disabled?: (i: number) => boolean;
  compact?: boolean;
}) {
  const at = cellAt(SIZE);
  const text = `font-mono ${compact ? "text-[9px]" : "text-[11px]"}`;
  const axis = (on: boolean) => `${text} ${on ? "font-bold text-fg" : "text-fg-muted"}`;
  const px = cross === null ? null : at(cross).x;
  const py = cross === null ? null : at(cross).y;
  return (
    <section aria-label={label} style={{ viewTransitionName: vt }}>
      <h2 className={`mb-2 font-semibold ${compact ? "text-xs" : "text-sm"}`} style={{ color }}>
        {label}
      </h2>
      <div
        className={`grid rounded-inset border border-line bg-surface-inset ${compact ? "p-1" : "p-1.5"} ${pointer ? "touch-none select-none" : ""}`}
        style={{ gridTemplateColumns: `${compact ? "0.9rem" : "1.25rem"} repeat(${SIZE}, minmax(0, 1fr))` }}
        onPointerDown={pointer && ((e) => pointer.down(cellUnder(e)))}
        onPointerMove={pointer && ((e) => pointer.move(cellUnder(e)) && e.currentTarget.setPointerCapture(e.pointerId))}
        onPointerUp={pointer && (() => pointer.up())}
        onPointerCancel={pointer && (() => pointer.up(true))}
      >
        {Array.from({ length: SIZE }, (_, k) => (
          <span key={`c${k}`} className={`pb-0.5 text-center ${axis(k === px)}`} style={{ gridColumn: k + 2, gridRow: 1 }}>
            {LETTERS[k]}
          </span>
        ))}
        {Array.from({ length: SIZE }, (_, k) => (
          <span key={`r${k}`} className={`flex items-center justify-center ${axis(k === py)}`} style={{ gridColumn: 1, gridRow: k + 2 }}>
            {k + 1}
          </span>
        ))}
        {shapes.map(({ ship, style, outline }, k) => {
          // Duch niedozwolonej pozycji może wystawać poza planszę: przycinamy, żeby siatka nie dostała nowych kolumn.
          const span = Math.min(ship.length, SIZE - (ship.vertical ? ship.y : ship.x));
          return (
            <span
              key={`s${k}`}
              className={`pointer-events-none rounded-md transition-colors duration-100 ${outline ? "outline-2 -outline-offset-2 outline-fg" : ""}`}
              style={{
                gridColumn: `${ship.x + 2} / span ${ship.vertical ? 1 : span}`,
                gridRow: `${ship.y + 2} / span ${ship.vertical ? span : 1}`,
                ...style,
              }}
              aria-hidden
            />
          );
        })}
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const { x, y } = at(i);
          const { background, content, ring } = cell(i);
          const crossed = x === px || y === py ? "color-mix(in srgb, var(--color-fg) 6%, transparent)" : undefined;
          const style = { gridColumn: x + 2, gridRow: y + 2, background: background ?? crossed };
          const className = `grid aspect-square place-items-center border-r border-b border-line-hover ${x === 0 ? "border-l" : ""} ${
            y === 0 ? "border-t" : ""
          } ${ring ? "outline-2 -outline-offset-2 outline-fg" : ""}`;
          return onTap ? (
            <button
              key={i}
              type="button"
              data-cell={i}
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
