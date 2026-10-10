import { type LobbyPlayer, ROK_MAX_YEAR as MAX_YEAR, ROK_MIN_YEAR as MIN_YEAR, ROK_ROUND_MS, ROK_ROUNDS, type RokView } from "@mini-games/games";
import { useEffect, useState } from "react";
import { Intro, Scores } from "../screens/ui.tsx";

interface Props {
  view: RokView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; answers: number[] } | { type: "progress"; done: number }) => void;
}

const midpoint = Math.round((MIN_YEAR + MAX_YEAR) / 2);
const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

function Preview() {
  return (
    <div className="flex w-full max-w-[240px] flex-col gap-2">
      <div className="flex justify-between text-[10px] text-fg-muted">
        <span>{MIN_YEAR}</span>
        <span>{midpoint}</span>
        <span>{MAX_YEAR}</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-line">
        <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg animate-[preview-half_3s_linear_infinite]" />
      </div>
      <div className="font-mono text-3xl font-semibold tabular-nums animate-[preview-half_3s_linear_infinite] [animation-delay:-1.5s]">1962</div>
    </div>
  );
}

function AnswerSheet({ events, answers }: { events: { text: string; year: number }[]; answers: number[] }) {
  return (
    <div className="grid gap-2">
      {events.map((event, index) => {
        const answer = answers[index];
        const diff = answer - event.year;
        return (
          <div key={`${event.text}-${index}`} className="flex items-start justify-between gap-3 rounded-inset border border-line p-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-fg">{event.text}</div>
              <div className="mt-1 font-mono text-xs text-fg-muted">Było {event.year}</div>
            </div>
            <span className={`font-mono font-semibold tabular-nums ${diff === 0 ? "text-success" : "text-fg"}`}>
              {answer}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type Phase = "intro" | "answer" | "reveal" | "sent";

export function Rok({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<number[]>([]);
  const [year, setYear] = useState<number>(midpoint);
  const [timeLeft, setTimeLeft] = useState<number>(ROK_ROUND_MS);
  const index = phase === "reveal" ? answers.length - 1 : answers.length;
  const event = view.events[index];
  const color = players.find((p) => p.id === me)?.color;

  useEffect(() => {
    if (phase !== "answer") return;
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setTimeLeft(Math.max(0, ROK_ROUND_MS - elapsed));
    }, 80);
    const timeout = window.setTimeout(() => {
      submitAnswer();
    }, ROK_ROUND_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(timeout);
    };
  }, [phase, index, year]);

  function submitAnswer() {
    const next = [...answers, year];
    setAnswers(next);
    setPhase("reveal");
    if (next.length < ROK_ROUNDS) onMove({ type: "progress", done: next.length });
  }

  function nextRound() {
    if (answers.length < ROK_ROUNDS) {
      setYear(midpoint);
      setPhase("answer");
      setTimeLeft(ROK_ROUND_MS);
      return;
    }
    setPhase("sent");
    onMove({ type: "result", answers });
  }

  const over = ranking !== undefined;
  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: id in view.results ? String(view.results[id]) : null };
  });

  if (!playing || phase === "sent") {
    const shown = (over ? ranking ?? [] : [me]).filter((id) => view.answers[id]);
    return (
      <>
        <Scores rows={rows} />
        <p className="text-sm text-fg-muted">Suma odchylek w latach, mniej znaczy lepiej.</p>
        {shown.map((id) => (
          <section key={id} className="tile flex flex-col gap-2 p-3">
            <span className="text-sm">
              {rows.find((r) => r.id === id)?.nick}
              {id === me && <span className="text-fg-muted"> (ty)</span>}
            </span>
            {view.answers[id]?.length ? <AnswerSheet events={view.events} answers={view.answers[id]} /> : <span className="text-sm text-fg-muted">Bez odpowiedzi</span>}
          </section>
        ))}
      </>
    );
  }

  if (phase === "intro") {
    return (
      <Intro
        preview={<Preview />}
        time={`${ROK_ROUNDS} rund, ${Math.round(ROK_ROUND_MS / 1000)} s na każdą`}
        task="Ustaw rok suwakiem i zaznacz odpowiedź"
        score="Liczy się suma odchylek w latach, mniej znaczy lepiej"
        onStart={() => setPhase("answer")}
      />
    );
  }

  if (phase === "reveal") {
    const last = answers[answers.length - 1] ?? year;
    const diff = last - event.year;
    return (
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label">Runda {answers.length}/{ROK_ROUNDS}</span>
          <span className="label">Suma błędów {answers.reduce((sum, answer, i) => sum + Math.abs(answer - view.events[i].year), 0)}</span>
        </div>
        <div className="tile flex flex-col gap-3 p-4">
          <p className="text-sm text-fg-muted">{event.text}</p>
          <div className="flex items-baseline justify-between gap-3">
            <p>
              Było <span className="font-mono font-semibold tabular-nums">{event.year}</span>, ustawiłeś{" "}
              <span className="font-mono font-semibold tabular-nums">{last}</span>
            </p>
            <span className={`font-mono text-3xl font-semibold tabular-nums ${diff === 0 ? "text-success" : ""}`}>
              {diff === 0 ? "Idealnie" : signed(diff)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-line">
            <span
              className="block h-full rounded-full bg-success transition-[width]"
              style={{ width: `${Math.min(100, (Math.abs(diff) / 50) * 100)}%` }}
            />
          </div>
          <button type="button" className="btn w-full text-bg" style={{ backgroundColor: color }} onClick={nextRound} autoFocus>
            {answers.length < ROK_ROUNDS ? "Następna runda" : "Wyniki"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="label">Runda {answers.length + 1}/{ROK_ROUNDS}</span>
        <span className="label">Czas {Math.ceil(timeLeft / 1000)} s</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${(timeLeft / ROK_ROUND_MS) * 100}%` }} />
      </div>
      <div className="tile flex flex-col gap-4 p-4">
        <p className="text-sm text-fg-muted">{event.text}</p>
        <div className="text-center">
          <div className="font-mono text-5xl font-semibold tabular-nums">{year}</div>
          <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
            <span>{MIN_YEAR}</span>
            <span>{MAX_YEAR}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost size-12 p-0" aria-label="Odejmij rok" onClick={() => setYear((y) => Math.max(MIN_YEAR, y - 1))}>
            −1
          </button>
          <input
            type="range"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="swatch-range flex-1"
            aria-label="Rok"
          />
          <button type="button" className="btn btn-ghost size-12 p-0" aria-label="Dodaj rok" onClick={() => setYear((y) => Math.min(MAX_YEAR, y + 1))}>
            +1
          </button>
        </div>
        <button type="button" className="btn w-full text-bg" style={{ backgroundColor: color }} onClick={submitAnswer}>
          Zatwierdź
        </button>
      </div>
    </section>
  );
}
