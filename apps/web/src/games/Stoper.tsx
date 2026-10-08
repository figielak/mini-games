import { type LobbyPlayer, STOPER_TARGET_MS, STOPER_VISIBLE_MS, type StoperView } from "@mini-games/games";
import { useEffect, useRef, useState } from "react";
import { Scores } from "../screens/ui.tsx";

interface Props {
  view: StoperView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; deviation: number }) => void;
}

/** Po tylu ms bez dotknięcia partia kończy się sama (najgorszy wynik). */
const GIVE_UP_MS = 2 * STOPER_TARGET_MS;

const seconds = (ms: number) => (ms / 1000).toFixed(2).replace(".", ",");

type Phase = "intro" | "run" | "sent";

export function Stoper({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [elapsed, setElapsed] = useState(0);
  const [stopped, setStopped] = useState<number | null>(null);
  const start = useRef(0);

  function stop() {
    const took = Math.min(performance.now() - start.current, GIVE_UP_MS);
    setStopped(took);
    setPhase("sent");
    onMove({ type: "result", deviation: Math.min(STOPER_TARGET_MS, Math.round(Math.abs(took - STOPER_TARGET_MS))) });
  }

  useEffect(() => {
    if (phase !== "run") return;
    const id = setInterval(() => {
      setElapsed(performance.now() - start.current);
      if (performance.now() - start.current >= GIVE_UP_MS) stop();
    }, 30);
    return () => clearInterval(id);
  }, [phase]);

  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: id in view.results ? `${view.results[id]} ms` : null };
  });

  if (!playing || phase === "sent") {
    return (
      <>
        {stopped !== null && (
          <p className="tile p-4 text-center">
            Twój czas: <span className="font-mono font-semibold">{seconds(stopped)} s</span>
          </p>
        )}
        <Scores rows={rows} />
      </>
    );
  }

  if (phase === "intro") {
    return (
      <section className="tile flex flex-col gap-4 p-4">
        <p>Stoper rusza od zera, po 3 sekundach znika. Dotknij, gdy uznasz, że minęło dokładnie 10,00 s. Liczy się odchyłka.</p>
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => {
            start.current = performance.now();
            setElapsed(0);
            setPhase("run");
          }}
        >
          Start
        </button>
      </section>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={stop}
      className="flex min-h-80 flex-1 touch-none select-none flex-col items-center justify-center gap-2 rounded-[20px] border border-line bg-surface"
    >
      <span className="font-mono text-6xl font-semibold tabular-nums">{elapsed < STOPER_VISIBLE_MS ? seconds(elapsed) : "?,??"}</span>
      <span className="text-fg-muted">Dotknij przy 10,00 s</span>
    </button>
  );
}
