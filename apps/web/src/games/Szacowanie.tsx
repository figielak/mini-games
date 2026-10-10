import type { LobbyPlayer } from "@mini-games/games";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Intro, Scores } from "../screens/ui.tsx";

/** Wspólny ekran gier „zobacz przez chwilę, wpisz liczbę”: Policz kropki i Kąt. */
interface Props {
  view: { players: string[]; results: Record<string, number>; answers: Record<string, number[]> };
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; answers: number[] } | { type: "progress"; done: number }) => void;
  /** Prawdziwa wartość w każdej rundzie. */
  truths: number[];
  /** Zawartość kafla w rundzie `index`: przy pokazie i (z `reveal`) przy porównaniu po odpowiedzi. */
  draw: (index: number, reveal: boolean) => ReactNode;
  showMs: number;
  /** Największa odpowiedź, jaką przyjmie serwer. */
  maxAnswer: number;
  /** Dopisek do liczb, np. „°”. */
  unit?: string;
  question: string;
  preview: ReactNode;
  time: ReactNode;
  task: ReactNode;
  score: ReactNode;
}

/** Pusta plansza przed pokazem, żeby wzrok zdążył wrócić z przycisku. */
const WAIT_MS = 800;

/** Prawdziwa wartość | odpowiedź w każdej rundzie. */
function Answers({ truths, answers, unit }: { truths: number[]; answers: number[]; unit: string }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      <span className="col-span-5 text-xs text-fg-muted">u góry było, niżej wpisane</span>
      {truths.map((n, i) => (
        <div key={i} className="flex flex-col items-center rounded-inset border border-line py-1 font-mono">
          <span>
            {n}
            {unit}
          </span>
          <span className={answers[i] === n ? "text-success" : "text-fg-muted"}>
            {answers[i]}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Różnica ze znakiem: „−4”, „+3”. */
const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

type Phase = "intro" | "wait" | "show" | "answer" | "reveal" | "sent";

export function Szacowanie({ view, me, players, ranking, onMove, truths, draw, showMs, maxAnswer, unit = "", question, preview, time, task, score }: Props) {
  const rounds = truths.length;
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<number[]>([]);
  const [input, setInput] = useState("");
  const index = phase === "reveal" ? answers.length - 1 : answers.length;
  const color = players.find((p) => p.id === me)?.color;
  const valid = input !== "" && Number(input) <= maxAnswer;

  useEffect(() => {
    if (phase !== "wait" && phase !== "show") return;
    const id = setTimeout(() => setPhase(phase === "wait" ? "show" : "answer"), phase === "wait" ? WAIT_MS : showMs);
    return () => clearTimeout(id);
  }, [phase]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const all = [...answers, Number(input)];
    setAnswers(all);
    setInput("");
    setPhase("reveal");
    if (all.length < rounds) onMove({ type: "progress", done: all.length });
  }

  function next() {
    if (answers.length < rounds) return setPhase("wait");
    setPhase("sent");
    onMove({ type: "result", answers });
  }

  const over = ranking !== undefined;
  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: id in view.results ? String(view.results[id]) : null };
  });

  if (!playing || phase === "sent") {
    // Na koniec odpowiedzi wszystkich; w trakcie tylko własne.
    const shown = (over ? (ranking ?? []) : [me]).filter((id) => view.answers[id]);
    return (
      <>
        <Scores rows={rows} />
        <p className="text-sm text-fg-muted">Suma pomyłek z {rounds} rund, mniej znaczy lepiej.</p>
        {shown.map((id) => (
          <section key={id} className="tile flex flex-col gap-2 p-3">
            <span className="text-sm">
              {rows.find((r) => r.id === id)?.nick}
              {id === me && <span className="text-fg-muted"> (ty)</span>}
            </span>
            {view.answers[id].length ? (
              <Answers truths={truths} answers={view.answers[id]} unit={unit} />
            ) : (
              <span className="text-sm text-fg-muted">Bez odpowiedzi</span>
            )}
          </section>
        ))}
      </>
    );
  }

  if (phase === "intro") {
    return <Intro preview={preview} time={time} task={task} score={score} onStart={() => setPhase("wait")} />;
  }

  const counter = (
    <div className="flex justify-between">
      <span className="label">
        Runda {index + 1}/{rounds}
      </span>
      <span className="label">Suma błędów {answers.reduce((s, a, i) => s + Math.abs(a - truths[i]), 0)}</span>
    </div>
  );

  const truth = truths[index];
  const diff = (answers[index] ?? 0) - truth;

  // Kafel stoi w tym samym miejscu we wszystkich fazach, żeby układ nie skakał.
  // Na niskim ekranie maleje, żeby przycisk pod porównaniem mieścił się bez przewijania (23,5rem = nagłówek gry + wiersze pod kaflem).
  return (
    <section className="flex flex-col gap-2">
      {counter}
      <div className="tile relative mx-auto aspect-square w-full max-w-[calc(100dvh-23.5rem)]">
        {(phase === "show" || phase === "reveal") && draw(index, phase === "reveal")}
        {phase === "answer" && (
          // Na telefonie przy górnej krawędzi: przycisk musi zostać nad klawiaturą (numeryczna na iOS nie ma Entera).
          <form className="absolute inset-0 flex flex-col gap-3 p-4 sm:justify-center" onSubmit={submit}>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-fg-muted">{question}</span>
              <input
                className="field text-center font-mono text-3xl"
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, String(maxAnswer).length))}
              />
            </label>
            <button type="submit" className="btn w-full text-bg" style={{ backgroundColor: color }} disabled={!valid}>
              Zatwierdź
            </button>
          </form>
        )}
      </div>
      {phase === "reveal" && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p>
              Było{" "}
              <span className="font-mono font-semibold tabular-nums">
                {truth}
                {unit}
              </span>
              , wpisałeś{" "}
              <span className="font-mono font-semibold tabular-nums">
                {answers[index]}
                {unit}
              </span>
            </p>
            <span className={`font-mono text-3xl font-semibold tabular-nums ${diff === 0 ? "text-success" : ""}`}>
              {diff === 0 ? "Idealnie" : signed(diff)}
            </span>
          </div>
          <button type="button" className="btn w-full text-bg" style={{ backgroundColor: color }} autoFocus onClick={next}>
            {answers.length < rounds ? "Następna runda" : "Wyniki"}
          </button>
        </>
      )}
    </section>
  );
}
