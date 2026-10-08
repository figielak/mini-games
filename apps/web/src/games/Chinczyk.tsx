import { useEffect, useRef, useState } from "react";
import { ArrowRight, DiceFive, DiceFour, DiceOne, DiceSix, DiceThree, DiceTwo } from "@phosphor-icons/react";
import { CHINCZYK_TRACK as TRACK, type ChinczykView, type LobbyPlayer } from "@mini-games/games";
import { StickyBar } from "../screens/ui.tsx";

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
/** Kierunek ruchu z pola startowego każdego miejsca (obrót strzałki w prawo). */
const START_ARROW = [0, 90, 180, 270];
const CENTER = 5 * 11 + 5;
const DICE = [DiceOne, DiceTwo, DiceThree, DiceFour, DiceFive, DiceSix];

const key = ([x, y]: Cell) => y * 11 + x;
const mix = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--color-bg))`;
/** Kolor gracza o stałej jasności (OKLCH): niebieski i żółty wychodzą równie wyraźne. */
const tint = (color: string, lightness: number, chroma: number) => `oklch(from ${color} ${lightness} calc(c * ${chroma}) h)`;
/** Meta miejsca bez gracza: ledwo widoczna. */
const UNUSED = mix("var(--color-fg)", 6);

/** Tempo animacji: krok pionka o jedno pole i czas turlania kostki. */
const STEP_MS = 180;
const ROLL_MS = 700;
const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Czy kostka się właśnie turla: przez chwilę po każdym nowym rzucie (nie po odświeżeniu strony). */
function useRolling(roll: number | undefined): boolean {
  const last = useRef(roll);
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (last.current === roll) return;
    last.current = roll;
    if (reducedMotion) return;
    setRolling(true);
    const t = setTimeout(() => setRolling(false), ROLL_MS);
    return () => clearTimeout(t);
  }, [roll]);
  return rolling;
}

/**
 * Pozycje pionków do wyświetlenia: pionek idzie pole po polu (wyjście z domku to jeden krok).
 * Zbicia i dalekie skoki (powrót po zerwanym połączeniu) zmieniają się od razu, ale dopiero gdy nikt już nie idzie.
 */
function useWalk(target: Record<string, number[]>, paused: boolean): Record<string, number[]> {
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (paused) return;
    const walking = (p: string, i: number) => {
      const from = shown[p]?.[i];
      return from !== undefined && target[p][i] > from && target[p][i] - from <= 6;
    };
    const ids = Object.keys(target);
    if (ids.every((p) => target[p].every((pos, i) => shown[p]?.[i] === pos))) return;
    if (reducedMotion || !ids.some((p) => target[p].some((_, i) => walking(p, i)))) return setShown(target);
    const t = setTimeout(() => {
      setShown((prev) => Object.fromEntries(ids.map((p) => [p, (prev[p] ?? target[p]).map((pos, i) => (walking(p, i) ? (pos < 0 ? 0 : pos + 1) : pos))])));
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [shown, target, paused]);
  return shown;
}

/** Kostka: w trakcie turlania co chwilę losowe oczka i podskakiwanie, potem wynik z serwera. */
function Die({ value, rolling, color }: { value: number; rolling: boolean; color?: string }) {
  const [face, setFace] = useState(value);
  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90);
    return () => clearInterval(id);
  }, [rolling]);
  const Face = DICE[(rolling ? face : value) - 1];
  return (
    <Face
      size={48}
      weight="fill"
      className={`shrink-0 ${rolling ? "animate-[dice-tumble_0.3s_ease-in-out_infinite]" : ""}`}
      style={{ color }}
      aria-label={rolling ? "Rzut kostką" : `Wyrzucono ${value}`}
    />
  );
}

export function Chinczyk({ view, me, players, canMove, onMove }: Props) {
  const color = (id: string) => players.find((p) => p.id === id)?.color ?? "#8b8b92";
  const nick = (id: string) => players.find((p) => p.id === id)?.nick ?? "?";
  const last = view.last;
  const rolling = useRolling(last?.roll);
  const shown = useWalk(view.pawns, rolling);
  const settled = !rolling && view.players.every((p) => shown[p]?.every((pos, i) => pos === view.pawns[p][i]));
  const myMove = canMove && settled && view.phase === "move";

  // Wybrany pionek pokazuje cel; drugie dotknięcie (pionka albo celu) wykonuje ruch.
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setSelected(null), [last?.roll, view.phase]);
  const pick = selected !== null && myMove && view.movable.includes(selected) ? selected : null;

  // Zbity pionek: krótka wibracja u właściciela, raz na ruch.
  const buzzed = useRef(last?.roll);
  useEffect(() => {
    if (!settled || !last?.move || buzzed.current === last.roll) return;
    buzzed.current = last.roll;
    if (last.move.captured.includes(me)) navigator.vibrate?.([60, 40, 60]);
  }, [settled, last, me]);

  const seatOf = (player: string) => view.starts[player] / (TRACK / 4);
  const cellOf = (player: string, pos: number, index: number) =>
    pos < 0 ? BASES[seatOf(player)][index] : pos < TRACK ? TRACK_CELLS[(view.starts[player] + pos) % TRACK] : HOMES[seatOf(player)][pos - TRACK];

  // Gracz na każdym z czterech miejsc (przy dwóch graczach dwa miejsca puste).
  const seats = [0, 1, 2, 3].map((seat) => view.players.find((p) => seatOf(p) === seat));

  // Każde pole planszy: tło (tor, start, domek gracza), strzałka kierunku na starcie i ewentualny pionek.
  const cells = new Map<number, { background?: string; ring?: string; empty?: boolean; arrow?: number; pawn?: { player: string; index: number } }>();
  for (const c of TRACK_CELLS) cells.set(key(c), {});
  seats.forEach((player, seat) => {
    const c = player && color(player);
    // Start: zabarwione pole z obwódką, która zostaje widoczna także pod pionkiem.
    if (c) cells.set(key(TRACK_CELLS[seat * (TRACK / 4)]), { background: tint(c, 0.5, 0.8), ring: c, arrow: START_ARROW[seat] });
    // Domek końcowy bez gracza wygląda jak zwykłe pole: ciemniejszy pas wyglądał jak cień.
    // Domki miejsca bez gracza: sama cienka obwódka, żeby plansza była kompletna, a pola wyraźnie puste.
    for (const cell of HOMES[seat]) cells.set(key(cell), c ? { background: tint(c, 0.42, 0.7) } : { empty: true });
    for (const cell of BASES[seat]) cells.set(key(cell), c ? { background: tint(c, 0.3, 0.5) } : { empty: true });
  });
  for (const player of view.players) {
    (shown[player] ?? view.pawns[player]).forEach((pos, index) => {
      const k = key(cellOf(player, pos, index));
      cells.set(k, { ...cells.get(k), pawn: { player, index } });
    });
  }

  // Podgląd celu wybranego pionka (jak w regułach: z domku startowego na pole 0).
  const from = pick !== null ? view.pawns[me][pick] : null;
  const to = from === null ? null : from < 0 ? 0 : from + view.dice!;
  const targetKey = to === null ? null : key(cellOf(me, to, pick!));
  const victim = targetKey === null ? undefined : cells.get(targetKey)?.pawn;
  const capture = victim && victim.player !== me ? victim.player : null;

  const status = (() => {
    if (!last || rolling) return null;
    if (last.note === "sixes") return "Trzecia szóstka z rzędu, tura przepada.";
    if (last.note === "none") {
      if (last.dice === 6) return "Brak ruchu, ale szóstka daje kolejny rzut.";
      if (view.pawns[last.player].some((p) => p >= 0 && p < TRACK)) return "Brak możliwego ruchu.";
      return view.turn === last.player ? `Bez szóstki. Próba ${4 - view.tries} z 3.` : "Bez szóstki, tura przechodzi.";
    }
    if (!last.move || !settled) return null;
    if (last.move.to >= TRACK && view.ranking.includes(last.player))
      return `${nick(last.player)} kończy na ${view.ranking.indexOf(last.player) + 1}. miejscu!`;
    if (last.move.captured.length) return `${nick(last.player)} zbija: ${last.move.captured.map(nick).join(", ")}!`;
    if (last.dice === 6 && view.turn === last.player) return "Szóstka, kolejny rzut.";
    return null;
  })();

  const prompt = (() => {
    if (view.phase === "over" || !view.turn) return null;
    if (!settled) return null;
    if (myMove) {
      if (pick === null) return "Wybierz pionek.";
      return capture ? `Zbijesz pionek: ${nick(capture)}. Dotknij celu, żeby ruszyć.` : "Dotknij celu albo pionka jeszcze raz, żeby ruszyć.";
    }
    if (canMove) return null;
    return view.phase === "move" ? `${nick(view.turn)} wybiera pionek…` : `${nick(view.turn)} rzuca kostką…`;
  })();

  const rollNow = canMove && settled && view.phase === "roll";
  const move = (pawn: number) => onMove({ type: "move", pawn });

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="tile grid aspect-square w-full gap-[3px] p-2" style={{ gridTemplate: "repeat(11, minmax(0, 1fr)) / repeat(11, minmax(0, 1fr))" }}>
        {Array.from({ length: 121 }, (_, i) => {
          if (i === CENTER) return <Finish key={i} colors={seats.map((p) => (p ? tint(color(p), 0.62, 0.9) : UNUSED))} />;
          const cell = cells.get(i);
          if (!cell) return <span key={i} />;
          if (cell.empty) return <span key={i} className="m-[3px] rounded-full border border-fg/15" aria-hidden />;
          const pawn = cell.pawn;
          const movable = !!pawn && myMove && pawn.player === me && view.movable.includes(pawn.index);
          const isPick = movable && pawn!.index === pick;
          const isTarget = i === targetKey;
          const inner = pawn ? (
            <span
              className={`size-[70%] rounded-full border-2 border-bg ${
                isPick ? "outline-2 outline-offset-1 outline-accent" : movable ? "animate-[ring-pulse_1s_ease-in-out_infinite] outline-2 outline-accent" : ""
              }`}
              style={{ backgroundColor: color(pawn.player) }}
            />
          ) : isTarget ? (
            // Duch pionka na polu docelowym.
            <span className="size-[60%] rounded-full border-2 border-dashed opacity-70" style={{ borderColor: color(me) }} />
          ) : (
            cell.arrow !== undefined && (
              <ArrowRight weight="bold" className="size-[55%] text-bg" style={{ transform: `rotate(${cell.arrow}deg)` }} aria-hidden />
            )
          );
          // Tor wyraźnie jaśniejszy od tła: surface-inset zlewał się ze stroną.
          const className = `grid place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-fg)_11%,var(--color-bg))] ${
            isTarget ? `outline-2 outline-offset-1 ${capture ? "outline-warning" : "outline-fg"}` : ""
          }`;
          const action = isTarget ? () => move(pick!) : movable ? () => (isPick ? move(pawn!.index) : setSelected(pawn!.index)) : null;
          return action ? (
            <button
              key={i}
              type="button"
              aria-label={isTarget ? `Rusz pionek ${pick! + 1} tutaj` : isPick ? `Rusz pionek ${pawn!.index + 1}` : `Wybierz pionek ${pawn!.index + 1}`}
              className={className}
              style={{ backgroundColor: cell.background, boxShadow: cell.ring && `inset 0 0 0 2px ${cell.ring}` }}
              onClick={action}
            >
              {inner}
            </button>
          ) : (
            <span key={i} className={className} style={{ backgroundColor: cell.background, boxShadow: cell.ring && `inset 0 0 0 2px ${cell.ring}` }}>
              {inner}
            </span>
          );
        })}
      </div>

      {/* Odstęp spycha dolny obszar na dół ekranu; sticky trzyma go pod kciukiem, gdy plansza się nie mieści. */}
      <span className="-mt-3 flex-1" aria-hidden />

      {/* Jeden obszar na dole: przy rzucie duży przycisk w kolorze gracza, poza tym ostatni rzut i podpowiedź. */}
      <StickyBar>
        <div className="flex w-full flex-col gap-2" aria-live="polite">
          {rollNow ? (
            <>
              {/* Kolejną próbę na szóstkę pokazuje już przycisk. */}
              {status && !(last?.note === "none" && last.dice !== 6) && <p className="text-center text-sm font-bold">{status}</p>}
              <button
                type="button"
                className="btn h-14 w-full text-lg font-semibold text-bg"
                style={{ backgroundColor: color(me) }}
                onClick={() => onMove({ type: "roll" })}
              >
                <DiceFive size={24} weight="fill" aria-hidden />
                Rzuć
                {!view.pawns[me].some((p) => p >= 0 && p < TRACK) && <span className="font-normal">(próba {4 - view.tries} z 3)</span>}
              </button>
            </>
          ) : (
            <div className="tile flex min-h-14 items-center gap-3 px-4 py-2">
              {last ? (
                <Die value={last.dice} rolling={rolling} color={color(last.player)} />
              ) : (
                <span className="size-12 shrink-0 rounded-inset border border-line" aria-hidden />
              )}
              <div className="flex flex-1 flex-col gap-0.5">
                {last && (
                  <p className="text-sm">
                    <span className="font-bold" style={{ color: color(last.player) }}>
                      {last.player === me ? "Ty" : nick(last.player)}
                    </span>{" "}
                    {last.player === me ? (rolling ? "rzucasz…" : `wyrzucasz ${last.dice}`) : rolling ? "rzuca…" : `wyrzuca ${last.dice}`}
                  </p>
                )}
                {status && <p className="text-sm font-bold">{status}</p>}
                {prompt && <p className="text-sm text-fg-muted">{prompt}</p>}
              </div>
            </div>
          )}
        </div>
      </StickyBar>
    </div>
  );
}

/** Meta na środku krzyża: cztery trójkąty skierowane do domków (lewo, góra, prawo, dół). */
function Finish({ colors }: { colors: string[] }) {
  const triangles = ["0,0 1,1 0,2", "0,0 2,0 1,1", "2,0 2,2 1,1", "0,2 2,2 1,1"];
  return (
    <svg viewBox="0 0 2 2" className="size-full overflow-hidden rounded-[6px]" role="img" aria-label="Meta">
      {triangles.map((points, i) => (
        <polygon key={points} points={points} fill={colors[i]} />
      ))}
    </svg>
  );
}
