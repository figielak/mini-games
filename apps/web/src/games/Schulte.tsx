import { type LobbyPlayer, SCHULTE_PENALTY_MS, SCHULTE_SIZE, type SchulteView, schulteTotal } from "@mini-games/games";
import { useEffect, useRef, useState } from "react";
import { Scores } from "../screens/ui.tsx";

interface Props {
  view: SchulteView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; ms: number; mistakes: number; splits: number[] } | { type: "progress"; found: number }) => void;
}

const LAST = SCHULTE_SIZE * SCHULTE_SIZE;
const seconds = (ms: number) => (ms / 1000).toFixed(1).replace(".", ",");

type Phase = "intro" | "run" | "sent";

export function Schulte({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [target, setTarget] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  // Ostatnio dotknięty kafelek; `id` rośnie, żeby błysk ruszył od nowa także przy tej samej liczbie.
  const [flash, setFlash] = useState<{ n: number; ok: boolean; id: number } | null>(null);
  const [now, setNow] = useState(0);
  const start = useRef(0);
  // Międzyczasy z zaokrąglonych znaczników, żeby ich suma była dokładnie równa wysłanemu czasowi.
  const splits = useRef<number[]>([]);

  useEffect(() => {
    if (phase !== "run") return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  function press(n: number) {
    if (n < target) return;
    setFlash((f) => ({ n, ok: n === target, id: (f?.id ?? 0) + 1 }));
    if (n !== target) {
      setMistakes((m) => m + 1);
      navigator.vibrate?.(60);
      return;
    }
    const ms = Math.round(performance.now() - start.current);
    splits.current.push(ms - splits.current.reduce((a, b) => a + b, 0));
    if (n < LAST) {
      onMove({ type: "progress", found: n });
      return setTarget(n + 1);
    }
    setPhase("sent");
    onMove({ type: "result", ms, mistakes, splits: splits.current });
  }

  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    const res = view.results[id];
    return {
      id,
      nick: p?.nick ?? "Gracz",
      color: p?.color,
      me: id === me,
      score: res ? `${seconds(schulteTotal(res))} s${res.mistakes ? ` (+${(res.mistakes * SCHULTE_PENALTY_MS) / 1000} s kary)` : ""}` : null,
    };
  });

  if (!playing || phase === "sent") {
    const series = rows.flatMap((r) => (view.results[r.id]?.splits.length ? [{ ...r, splits: view.results[r.id].splits }] : []));
    // Przewaga zwycięzcy nad drugim miejscem; przy remisie i w grze solo nie ma czego pokazywać.
    const [first, second] = (ranking ?? []).map((id) => schulteTotal(view.results[id]));
    const lead = second - first;
    return (
      <>
        <Scores rows={rows} />
        {(lead > 0 || series.length > 0) && (
          <section className="tile flex flex-col gap-3 p-4">
            {lead > 0 && (
              <p className="text-lg font-semibold" style={{ color: rows[0].color }}>
                {rows[0].me ? "Wygrywasz" : `${rows[0].nick} wygrywa`} o {(lead / 1000).toFixed(lead < 100 ? 2 : 1).replace(".", ",")} s
              </p>
            )}
            {series.length > 0 && <SplitChart series={series} />}
          </section>
        )}
      </>
    );
  }

  if (phase === "intro") {
    return (
      <section className="tile flex flex-col gap-4 p-4">
        <p>
          Dotykaj liczby od 1 do 25 po kolei, jak najszybciej. Każda pomyłka to {SCHULTE_PENALTY_MS / 1000} s kary.
        </p>
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => {
            start.current = performance.now();
            setNow(start.current);
            setPhase("run");
          }}
        >
          Start
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between font-mono text-sm text-fg-muted">
        <span>Szukaj: {target}</span>
        <span>
          {mistakes > 0 && <span className="text-warning">+{(mistakes * SCHULTE_PENALTY_MS) / 1000} s · </span>}
          Twój czas: {seconds(now - start.current)} s
        </span>
      </div>
      <div className="grid aspect-square grid-cols-5 gap-2">
        {view.grid.map((n) => (
          <button
            // Klucz z błysku: kafelek montuje się od nowa i animacja startuje jeszcze raz.
            key={n === flash?.n ? `${n}-${flash.id}` : n}
            type="button"
            onPointerDown={() => press(n)}
            className={`touch-none select-none rounded-inset border font-mono text-2xl font-semibold ${
              n < target && view.mode === "latwa" ? "border-transparent bg-surface-inset text-fg-subtle" : "border-line bg-surface"
            } ${n === flash?.n ? (flash.ok ? "animate-[tile-hit_0.35s_ease-out]" : "animate-[tile-miss_0.35s_ease-out]") : ""}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

const W = 320;
const H = 120;
const PAD = { left: 22, right: 6, top: 8, bottom: 16 };

/** Czas szukania kolejnych liczb: linia na gracza w jego kolorze, kropka na liczbie, której szukał najdłużej. */
function SplitChart({ series }: { series: { id: string; nick: string; color?: string; splits: number[] }[] }) {
  const hi = Math.max(1000, Math.ceil(Math.max(...series.flatMap((s) => s.splits)) / 1000) * 1000);
  const x = (i: number) => PAD.left + (i / (LAST - 1)) * (W - PAD.left - PAD.right);
  const y = (ms: number) => PAD.top + (1 - ms / hi) * (H - PAD.top - PAD.bottom);
  const slowest = (splits: number[]) => splits.indexOf(Math.max(...splits));
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        role="img"
        aria-label={`Czas szukania kolejnych liczb. ${series.map((s) => `${s.nick}: najdłużej ${slowest(s.splits) + 1}, ${seconds(Math.max(...s.splits))} s`).join("; ")}.`}
      >
        {[0, hi].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={PAD.left - 4} y={y(t) + 3} textAnchor="end" className="fill-fg-muted font-mono text-[9px]">
              {t / 1000} s
            </text>
          </g>
        ))}
        {[1, 5, 10, 15, 20, 25].map((n) => (
          <text key={n} x={x(n - 1)} y={H - 4} textAnchor="middle" className="fill-fg-muted font-mono text-[9px]">
            {n}
          </text>
        ))}
        {series.map((s) => (
          <polyline
            key={s.id}
            points={s.splits.map((ms, i) => `${x(i)},${y(ms)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {series.map((s) => (
          <circle key={s.id} cx={x(slowest(s.splits))} cy={y(Math.max(...s.splits))} r={4} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />
        ))}
      </svg>
      {/* Legenda zawsze (kolor nie może być jedynym nośnikiem tożsamości). */}
      <figcaption className="mt-2 flex flex-col gap-1 text-sm text-fg-muted">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="flex-1 text-fg">{s.nick}</span>
            <span className="font-mono">
              najdłużej {slowest(s.splits) + 1} ({seconds(Math.max(...s.splits))} s)
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
