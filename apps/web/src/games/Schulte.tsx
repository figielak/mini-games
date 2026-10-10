import { type LobbyPlayer, SCHULTE_PENALTY_MS, SCHULTE_SIZE, type SchulteView, schulteTotal } from "@mini-games/games";
import { useEffect, useRef, useState } from "react";
import { Scores } from "../screens/ui.tsx";

interface Props {
  view: SchulteView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; ms: number; mistakes: number } | { type: "progress"; found: number }) => void;
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
    if (n < LAST) {
      onMove({ type: "progress", found: n });
      return setTarget(n + 1);
    }
    setPhase("sent");
    onMove({ type: "result", ms: Math.round(performance.now() - start.current), mistakes });
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

  if (!playing || phase === "sent") return <Scores rows={rows} />;

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
