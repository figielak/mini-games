import { KOLO_ATTEMPTS, KOLO_MAX_POINTS, koloJudge, type KoloPoint, type KoloView, type LobbyPlayer } from "@mini-games/games";
import { type PointerEvent, useRef, useState } from "react";
import { Scores, Stats } from "../screens/ui.tsx";

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

function Drawing({ points, color, faint }: { points: KoloPoint[]; color?: string; faint?: boolean }) {
  return (
    <polyline
      points={polyline(points)}
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={0.015}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={faint ? 0.25 : 1}
    />
  );
}

export function Kolo({ view, me, players, ranking, onMove }: Props) {
  const attempts = view.attempts[me] ?? 0;
  const playing = view.players.includes(me) && attempts < KOLO_ATTEMPTS;
  const best = view.best[me];
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
    const { status, score } = koloJudge(sent);
    if (status !== "ok") return setHint(HINTS[status]);
    onMove({ type: "result", points: sent });
    // Rysunek znika, a najlepsza próba (z serwera) zostaje przygaszona w tle.
    drawn.current = [];
    setPoints([]);
    setHint(`Ta próba: ${percent(score)}`);
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
        <p className="text-fg-muted">Narysuj palcem jednym ruchem jak najdoskonalszy okrąg. Liczy się najlepsza z {KOLO_ATTEMPTS} prób.</p>
        <Stats
          items={[
            { label: "Próba", value: `${attempts + 1}/${KOLO_ATTEMPTS}` },
            { label: "Najlepsza", value: best ? percent(best.score) : "-" },
          ]}
        />
        <svg
          viewBox="0 0 1 1"
          className="aspect-square w-full touch-none select-none rounded-tile border border-line bg-surface [-webkit-touch-callout:none]"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={cancel}
        >
          {best && <Drawing points={best.points} color={color(me)} faint />}
          <Drawing points={points} color={color(me)} />
        </svg>
        {hint && <p className={`text-center ${hint.startsWith("Ta próba") ? "" : "text-warning"}`}>{hint}</p>}
        {best && (
          <button type="button" className="btn btn-ghost w-full" onClick={() => onMove({ type: "result", points: [] })}>
            Zostaw najlepszą i zakończ
          </button>
        )}
      </section>
    );
  }

  const order = ranking ?? view.players;
  const rows = order.map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: (view.attempts[id] ?? 0) >= KOLO_ATTEMPTS ? percent(view.best[id].score) : null };
  });

  return (
    <>
      <Scores rows={rows} />
      <ul className="flex flex-col gap-3">
        {rows
          .filter((r) => r.score !== null)
          .map((r) => (
            <li key={r.id} className="tile flex flex-col gap-2 p-3">
              <span className="truncate">{r.nick}</span>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["Najlepsze", view.best[r.id]],
                    ["Najgorsze", view.worst[r.id]],
                  ] as const
                ).map(([label, attempt]) => (
                  <figure key={label} className="flex flex-col gap-1">
                    <svg viewBox="0 0 1 1" className="aspect-square w-full rounded-inset bg-bg" aria-label={`${label} koło gracza ${r.nick}`}>
                      <Drawing points={attempt.points} color={r.color} />
                    </svg>
                    <figcaption className="flex justify-between gap-2 text-sm text-fg-muted">
                      {label}
                      <span className="font-mono text-fg">{percent(attempt.score)}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </li>
          ))}
      </ul>
    </>
  );
}
