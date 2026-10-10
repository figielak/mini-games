import { type LobbyPlayer, STOPER_VISIBLE_MS, type StoperView } from "@mini-games/games";
import { useEffect, useRef, useState } from "react";
import { Intro, Scores } from "../screens/ui.tsx";

interface Props {
  view: StoperView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; deviation: number }) => void;
}

/** Odliczanie „3, 2, 1” przed startem stopera. */
const COUNT_MS = 3000;

const seconds = (ms: number) => (ms / 1000).toFixed(2).replace(".", ",");

/** Podgląd na ekranie instrukcji: licznik biegnie, potem znika. */
function Preview() {
  return (
    <>
      {["1,00", "2,00", "3,00", "?,??"].map((text, i) => (
        <span
          key={text}
          className={`absolute animate-[preview-quarter_4s_linear_infinite] text-4xl font-semibold tabular-nums ${i ? "opacity-0" : ""}`}
          style={{ animationDelay: `${i - 4}s` }}
        >
          {text}
        </span>
      ))}
    </>
  );
}

type Phase = "intro" | "run" | "sent";

export function Stoper({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  // Ujemne w trakcie odliczania przed startem.
  const [elapsed, setElapsed] = useState(-COUNT_MS);
  const [stopped, setStopped] = useState<number | null>(null);
  const start = useRef(0);
  /** Po tylu ms bez dotknięcia partia kończy się sama (najgorszy wynik). */
  const giveUp = 2 * view.target;
  const goal = `${seconds(view.target)} s`;

  function stop() {
    const took = Math.min(performance.now() - start.current, giveUp);
    if (took < 0) return;
    setStopped(took);
    setPhase("sent");
    onMove({ type: "result", deviation: Math.min(view.target, Math.round(Math.abs(took - view.target))) });
  }

  useEffect(() => {
    if (phase !== "run") return;
    const id = setInterval(() => {
      setElapsed(performance.now() - start.current);
      if (performance.now() - start.current >= giveUp) stop();
    }, 30);
    return () => clearInterval(id);
  }, [phase]);

  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: id in view.results ? `${view.results[id]} ms` : null };
  });

  if (!playing || phase === "sent") {
    const diff = (stopped ?? 0) - view.target;
    const off = Math.abs(diff);
    return (
      <>
        {stopped !== null && (
          <section className="tile flex flex-col items-center gap-1 p-6">
            <span className="label">Twój czas</span>
            <span className="text-7xl font-semibold tabular-nums">{seconds(stopped)}</span>
            <span className={`text-2xl font-semibold tabular-nums ${off <= 100 ? "text-success" : off <= 500 ? "text-fg" : "text-warning"}`}>
              {diff < 0 ? "−" : "+"}
              {seconds(off)} s
            </span>
          </section>
        )}
        <Scores rows={rows} />
      </>
    );
  }

  if (phase === "intro") {
    return (
      <Intro
        preview={<Preview />}
        time={`Po odliczaniu 3, 2, 1 stoper rusza od zera i po ${STOPER_VISIBLE_MS / 1000} sekundach znika`}
        task={
          <>
            Dotknij, gdy uznasz, że minęło dokładnie <span className="font-semibold tabular-nums">{goal}</span>
          </>
        }
        score="Liczy się odchyłka od celu, mniej znaczy lepiej"
        onStart={() => {
          start.current = performance.now() + COUNT_MS;
          setPhase("run");
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onPointerDown={stop}
      className="flex min-h-80 flex-1 touch-none select-none flex-col items-center justify-center gap-2 rounded-tile border border-line bg-surface"
    >
      <span className="label">Cel</span>
      <span className="text-3xl font-semibold tabular-nums">{goal}</span>
      <span className="my-4 text-7xl font-semibold tabular-nums">
        {elapsed < 0 ? Math.ceil(-elapsed / 1000) : elapsed < STOPER_VISIBLE_MS ? seconds(elapsed) : "?,??"}
      </span>
      <span className="text-fg-muted">{elapsed < 0 ? "Przygotuj się" : `Dotknij, gdy minie ${goal}`}</span>
    </button>
  );
}
