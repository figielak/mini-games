import { type LobbyPlayer, QUIZ_DURATION_MS, type QuizMove } from "@mini-games/games";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Scores } from "../screens/ui.tsx";

/** Wspólny przebieg Stroopa i Szybkiego liczenia: 30 s pytań, cztery odpowiedzi, pomyłka blokuje na chwilę. */
interface Props {
  view: { players: string[]; results: Record<string, { times: number[]; errors: number }> };
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  intro: string;
  /** Pytanie i cztery odpowiedzi dla pytania nr i; correct to indeks dobrej. */
  question: (i: number) => { prompt: ReactNode; options: ReactNode[]; correct: number };
  onMove: (move: QuizMove) => void;
}

/** Bez kary losowe klepanie byłoby szybsze niż myślenie. */
const BLOCK_MS = 1000;
const MIN_ANSWER = 150;
const MAX_ANSWER = 5000;

type Phase = "intro" | "play" | "wrong" | "sent";

export function Quiz({ view, me, players, ranking, intro, question, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(0);
  const run = useRef({ start: 0, shownAt: 0, times: [] as number[], errors: 0, timer: 0 });

  function next() {
    run.current.shownAt = performance.now();
    setIndex((i) => i + 1);
    setPhase("play");
  }

  function start() {
    const t = performance.now();
    run.current = { start: t, shownAt: t, times: [], errors: 0, timer: 0 };
    setNow(t);
    setPhase("play");
  }

  function answer(option: number) {
    if (phase !== "play") return;
    const r = run.current;
    const took = Math.round(performance.now() - r.shownAt);
    if (option === question(index).correct) {
      // ponytail: odpowiedź po 5 s liczona jako 5 s, szybsza niż 150 ms przepada (serwer by ją odrzucił)
      if (took >= MIN_ANSWER) r.times.push(Math.min(took, MAX_ANSWER));
      next();
    } else {
      r.errors++;
      navigator.vibrate?.(60);
      setPhase("wrong");
      r.timer = window.setTimeout(next, BLOCK_MS);
    }
  }

  // Zegar gry: odświeża licznik i kończy partię po 30 s.
  useEffect(() => {
    if (phase === "intro" || phase === "sent") return;
    const id = setInterval(() => {
      const r = run.current;
      setNow(performance.now());
      if (performance.now() - r.start < QUIZ_DURATION_MS) return;
      clearTimeout(r.timer);
      setPhase("sent");
      onMove({ type: "result", times: r.times, errors: r.errors });
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
        <p>{intro}</p>
        <button type="button" className="btn btn-primary w-full" onClick={start}>
          Start
        </button>
      </section>
    );
  }

  const q = question(index);
  const left = Math.max(0, Math.ceil((QUIZ_DURATION_MS - (now - run.current.start)) / 1000));
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex justify-between font-mono text-sm text-fg-muted">
        <span>Trafienia: {run.current.times.length}</span>
        <span>{left} s</span>
      </div>
      <div className="tile flex min-h-40 flex-1 items-center justify-center p-4">
        {phase === "wrong" ? <span className="text-2xl font-semibold text-warning">Źle!</span> : q.prompt}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((option, i) => (
          <button
            key={i}
            type="button"
            disabled={phase !== "play"}
            onPointerDown={() => answer(i)}
            className="flex min-h-20 touch-none select-none items-center justify-center gap-2 rounded-tile border border-line bg-surface text-xl font-semibold disabled:opacity-40"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
