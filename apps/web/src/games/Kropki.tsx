import { KROPKI_ROUNDS, KROPKI_SHOW_MS, type KropkiView, type LobbyPlayer } from "@mini-games/games";
import { type FormEvent, useEffect, useState } from "react";
import { Scores } from "../screens/ui.tsx";

interface Props {
  view: KropkiView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; answers: number[] }) => void;
}

/** Pusta plansza przed kropkami, żeby wzrok zdążył wrócić z przycisku. */
const WAIT_MS = 800;

/** Liczba kropek | odpowiedź w każdej rundzie. */
function Answers({ counts, answers }: { counts: number[]; answers: number[] }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {counts.map((n, i) => (
        <div key={i} className="flex flex-col items-center rounded-inset border border-line py-1 font-mono">
          <span>{n}</span>
          <span className={answers[i] === n ? "text-success" : "text-fg-muted"}>{answers[i]}</span>
        </div>
      ))}
    </div>
  );
}

type Phase = "intro" | "wait" | "show" | "answer" | "sent";

export function Kropki({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<number[]>([]);
  const [input, setInput] = useState("");
  const index = answers.length;
  const counts = view.rounds.map((r) => r.length);

  useEffect(() => {
    if (phase !== "wait" && phase !== "show") return;
    const id = setTimeout(() => setPhase(phase === "wait" ? "show" : "answer"), phase === "wait" ? WAIT_MS : KROPKI_SHOW_MS);
    return () => clearTimeout(id);
  }, [phase]);

  function next(e: FormEvent) {
    e.preventDefault();
    if (input === "") return;
    const all = [...answers, Number(input)];
    setAnswers(all);
    setInput("");
    if (all.length < KROPKI_ROUNDS) return setPhase("wait");
    setPhase("sent");
    onMove({ type: "result", answers: all });
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
        {shown.map((id) => (
          <section key={id} className="tile flex flex-col gap-2 p-3">
            <span className="text-sm">
              {rows.find((r) => r.id === id)?.nick}
              {id === me && <span className="text-fg-muted"> (ty)</span>}
            </span>
            {view.answers[id].length ? <Answers counts={counts} answers={view.answers[id]} /> : <span className="text-sm text-fg-muted">Bez odpowiedzi</span>}
          </section>
        ))}
      </>
    );
  }

  if (phase === "intro") {
    return (
      <section className="tile flex flex-col gap-4 p-4">
        <p>
          {KROPKI_ROUNDS} rund. W każdej na pół sekundy pojawią się kropki, potem wpisz, ile ich było. Liczy się suma błędów: mniej znaczy lepiej.
        </p>
        <button type="button" className="btn btn-primary w-full" onClick={() => setPhase("wait")}>
          Start
        </button>
      </section>
    );
  }

  const counter = (
    <span className="label">
      Runda {index + 1}/{KROPKI_ROUNDS}
    </span>
  );

  if (phase !== "answer") {
    return (
      <section className="flex flex-col gap-2">
        {counter}
        <div className="tile relative aspect-square w-full">
          {phase === "show" &&
            view.rounds[index].map((d, i) => (
              <span
                key={i}
                className="absolute size-[5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
                style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
              />
            ))}
        </div>
      </section>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={next}>
      {counter}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-fg-muted">Ile było kropek?</span>
        <input
          className="field text-center font-mono text-3xl"
          inputMode="numeric"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 2))}
        />
      </label>
      <button type="submit" className="btn btn-primary w-full" disabled={input === ""}>
        {index + 1 < KROPKI_ROUNDS ? "Dalej" : "Zakończ"}
      </button>
    </form>
  );
}
