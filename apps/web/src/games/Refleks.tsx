import { type LobbyPlayer, REFLEKS_DURATION_MS, type RefleksView } from "@mini-games/games";
import { useEffect, useRef, useState } from "react";
import { Scores } from "../screens/ui.tsx";

type Move = { type: "result"; times: number[]; falseStarts: number };

interface Props {
  view: RefleksView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: Move) => void;
}

type Phase = "intro" | "wait" | "go" | "early" | "sent";

/** Reakcja szybsza niż 100 ms to zgadywanie: liczy się jak falstart (serwer i tak by ją odrzucił). */
const MIN_REACTION = 100;
const MAX_REACTION = 5000;

export function Refleks({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [last, setLast] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const run = useRef({ start: 0, goAt: 0, round: 0, times: [] as number[], falseStarts: 0, timer: 0 });

  function wait() {
    const r = run.current;
    setPhase("wait");
    r.timer = window.setTimeout(() => {
      r.goAt = performance.now();
      setPhase("go");
    }, view.delays[r.round++ % view.delays.length]);
  }

  function start() {
    run.current = { start: performance.now(), goAt: 0, round: 0, times: [], falseStarts: 0, timer: 0 };
    setLast(null);
    wait();
  }

  function tap() {
    const r = run.current;
    const reaction = performance.now() - r.goAt;
    clearTimeout(r.timer);
    if (phase === "go" && reaction >= MIN_REACTION) {
      if (reaction <= MAX_REACTION) r.times.push(Math.round(reaction));
      setLast(Math.round(reaction));
      wait();
    } else if (phase === "wait" || phase === "go") {
      r.falseStarts++;
      setPhase("early");
      r.timer = window.setTimeout(wait, 800);
    }
  }

  // Zegar gry: odświeża licznik i kończy partię po 30 s.
  useEffect(() => {
    if (phase === "intro" || phase === "sent") return;
    const id = setInterval(() => {
      const r = run.current;
      setNow(performance.now());
      if (performance.now() - r.start < REFLEKS_DURATION_MS) return;
      clearTimeout(r.timer);
      setPhase("sent");
      onMove({ type: "result", times: r.times, falseStarts: r.falseStarts });
    }, 100);
    return () => clearInterval(id);
  }, [phase === "intro" || phase === "sent"]);

  useEffect(() => () => clearTimeout(run.current.timer), []);

  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    const res = view.results[id];
    const avg = res?.times.length ? Math.round(res.times.reduce((a, b) => a + b, 0) / res.times.length) : null;
    return {
      id,
      nick: p?.nick ?? "Gracz",
      color: p?.color,
      me: id === me,
      score: res ? `${res.times.length} × ${avg ?? "-"} ms` : null,
    };
  });

  if (!playing || phase === "sent") return <Scores rows={rows} />;

  if (phase === "intro") {
    return (
      <section className="tile flex flex-col gap-4 p-4">
        <p>
          Dotknij pola, gdy zmieni kolor. Masz 30 sekund: im szybciej reagujesz, tym więcej trafień. Dotknięcie przed
          zmianą to falstart i strata czasu.
        </p>
        <button type="button" className="btn btn-primary w-full" onClick={start}>
          Start
        </button>
      </section>
    );
  }

  const left = Math.max(0, Math.ceil((REFLEKS_DURATION_MS - (now - run.current.start)) / 1000));
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex justify-between font-mono text-sm text-fg-muted">
        <span>Trafienia: {run.current.times.length}</span>
        <span>{left}s</span>
      </div>
      <button
        type="button"
        onPointerDown={tap}
        className={`flex min-h-80 flex-1 touch-none select-none items-center justify-center rounded-[20px] border border-line text-2xl font-semibold ${
          phase === "go" ? "bg-accent text-accent-fg" : "bg-surface text-fg-muted"
        }`}
      >
        {phase === "go" ? "Teraz!" : phase === "early" ? "Falstart!" : last !== null ? `${last} ms` : "Czekaj…"}
      </button>
    </div>
  );
}
