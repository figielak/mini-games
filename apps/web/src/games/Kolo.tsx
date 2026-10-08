import { KOLO_MAX_POINTS, koloJudge, type KoloPoint, type KoloView, type LobbyPlayer } from "@mini-games/games";
import { type PointerEvent, useRef, useState } from "react";
import { Scores } from "../screens/ui.tsx";

interface Props {
  view: KoloView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; points: KoloPoint[] }) => void;
}

/** Nowy punkt dopiero po przesunięciu o 1% płótna: punkty wychodzą równomiernie. */
const MIN_STEP = 0.01;
/** Wysyłamy z zapasem poniżej limitu serwera. */
const SEND_POINTS = KOLO_MAX_POINTS / 2;

const HINTS = {
  unfinished: "Niedokończone koło, narysuj jeszcze raz.",
  small: "Za małe, narysuj większe.",
};

const percent = (score: number) => `${(score / 10).toFixed(1).replace(".", ",")}%`;
const polyline = (points: KoloPoint[]) => points.map((p) => p.join(",")).join(" ");
const clamp = (v: number) => Math.min(1, Math.max(0, v));

function Drawing({ points, color }: { points: KoloPoint[]; color?: string }) {
  return (
    <polyline points={polyline(points)} fill="none" stroke={color ?? "currentColor"} strokeWidth={0.015} strokeLinecap="round" strokeLinejoin="round" />
  );
}

export function Kolo({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [points, setPoints] = useState<KoloPoint[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const drawn = useRef<KoloPoint[]>([]);
  /** Rysuje tylko pierwszy palec, kolejne są ignorowane. */
  const finger = useRef<number | null>(null);
  const color = (id: string) => players.find((p) => p.id === id)?.color;

  function at(e: PointerEvent<SVGSVGElement>): KoloPoint {
    const r = e.currentTarget.getBoundingClientRect();
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
  }

  function down(e: PointerEvent<SVGSVGElement>) {
    if (finger.current !== null) return;
    finger.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawn.current = [at(e)];
    setPoints(drawn.current);
    setHint(null);
  }

  function move(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerId !== finger.current) return;
    const p = at(e);
    const [x, y] = drawn.current[drawn.current.length - 1];
    if (Math.hypot(p[0] - x, p[1] - y) < MIN_STEP) return;
    drawn.current = [...drawn.current, p];
    setPoints(drawn.current);
  }

  function up(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerId !== finger.current) return;
    finger.current = null;
    const step = Math.ceil(drawn.current.length / SEND_POINTS);
    const sent = drawn.current.filter((_, i) => i % step === 0);
    // Niedokończone koło nie idzie na serwer, więc przypadkowe dotknięcie nie spala próby.
    const { status } = koloJudge(sent);
    if (status === "ok") onMove({ type: "result", points: sent });
    else setHint(HINTS[status]);
  }

  /** Gest systemowy (np. na iOS) przerywa rysowanie: zaczynamy od nowa zamiast wysyłać połówkę. */
  function cancel(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerId !== finger.current) return;
    finger.current = null;
    drawn.current = [];
    setPoints([]);
  }

  if (playing) {
    return (
      <section className="flex flex-col gap-3">
        <p className="text-fg-muted">Narysuj palcem jednym ruchem jak najdoskonalszy okrąg. Masz jedną próbę.</p>
        <svg
          viewBox="0 0 1 1"
          className="aspect-square w-full touch-none select-none rounded-[20px] border border-line bg-surface [-webkit-touch-callout:none]"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={cancel}
        >
          <Drawing points={points} color={color(me)} />
        </svg>
        {hint && <p className="text-center text-warning">{hint}</p>}
      </section>
    );
  }

  const order = ranking ?? view.players;
  const rows = order.map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: id in view.results ? percent(view.results[id].score) : null };
  });

  return (
    <>
      <Scores rows={rows} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows
          .filter((r) => r.score !== null)
          .map((r) => (
            <li key={r.id} className="tile flex flex-col gap-1 p-2">
              <svg viewBox="0 0 1 1" className="aspect-square w-full" aria-label={`Koło gracza ${r.nick}`}>
                <Drawing points={view.results[r.id].points} color={r.color} />
              </svg>
              <span className="flex justify-between gap-2 text-sm">
                <span className="truncate">{r.nick}</span>
                <span className="font-mono">{r.score}</span>
              </span>
            </li>
          ))}
      </ul>
    </>
  );
}
