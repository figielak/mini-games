import { KROPKI_ROUNDS, KROPKI_SHOW_MS, type KropkiView, type LobbyPlayer } from "@mini-games/games";
import { type FormEvent, useEffect, useState } from "react";
import { Intro, Scores } from "../screens/ui.tsx";

interface Props {
  view: KropkiView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; answers: number[] } | { type: "progress"; done: number }) => void;
}

/** Pusta plansza przed kropkami, żeby wzrok zdążył wrócić z przycisku. */
const WAIT_MS = 800;

/** Liczba kropek | odpowiedź w każdej rundzie. */
function Answers({ counts, answers }: { counts: number[]; answers: number[] }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      <span className="col-span-5 text-xs text-fg-muted">u góry było, niżej wpisane</span>
      {counts.map((n, i) => (
        <div key={i} className="flex flex-col items-center rounded-inset border border-line py-1 font-mono">
          <span>{n}</span>
          <span className={answers[i] === n ? "text-success" : "text-fg-muted"}>{answers[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** Różnica ze znakiem: „−4”, „+3”. */
const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** Podgląd na ekranie instrukcji: kropki migają, potem pytanie o liczbę. */
const PREVIEW_DOTS = [
  [12, 30], [22, 68], [30, 22], [38, 52], [44, 80], [52, 30], [58, 62], [66, 18], [72, 46], [78, 76], [86, 28], [90, 58],
];

function Preview() {
  return (
    <>
      {PREVIEW_DOTS.map(([x, y]) => (
        <span key={x} className="absolute size-2.5 animate-[preview-half_3s_linear_infinite] rounded-full bg-fg" style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
      <span className="animate-[preview-half_3s_linear_infinite] font-mono text-3xl font-semibold opacity-0 [animation-delay:-1.5s]">Ile?</span>
    </>
  );
}

type Phase = "intro" | "wait" | "show" | "answer" | "reveal" | "sent";

export function Kropki({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<number[]>([]);
  const [input, setInput] = useState("");
  const index = phase === "reveal" ? answers.length - 1 : answers.length;
  const color = players.find((p) => p.id === me)?.color;
  const counts = view.rounds.map((r) => r.length);

  useEffect(() => {
    if (phase !== "wait" && phase !== "show") return;
    const id = setTimeout(() => setPhase(phase === "wait" ? "show" : "answer"), phase === "wait" ? WAIT_MS : KROPKI_SHOW_MS);
    return () => clearTimeout(id);
  }, [phase]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (input === "") return;
    const all = [...answers, Number(input)];
    setAnswers(all);
    setInput("");
    setPhase("reveal");
    if (all.length < KROPKI_ROUNDS) onMove({ type: "progress", done: all.length });
  }

  function next() {
    if (answers.length < KROPKI_ROUNDS) return setPhase("wait");
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
        <p className="text-sm text-fg-muted">Suma pomyłek z {KROPKI_ROUNDS} rund, mniej znaczy lepiej.</p>
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
      <Intro
        preview={<Preview />}
        time={`${KROPKI_ROUNDS} rund, kropki widać przez ${String(KROPKI_SHOW_MS / 1000).replace(".", ",")} s`}
        task="Wpisz, ile ich było"
        score="Liczy się suma pomyłek (było 42, wpisujesz 38: 4 punkty), mniej znaczy lepiej"
        onStart={() => setPhase("wait")}
      />
    );
  }

  const counter = (
    <div className="flex justify-between">
      <span className="label">
        Runda {index + 1}/{KROPKI_ROUNDS}
      </span>
      <span className="label">Suma błędów {answers.reduce((s, a, i) => s + Math.abs(a - counts[i]), 0)}</span>
    </div>
  );

  const count = counts[index];
  const diff = (answers[index] ?? 0) - count;

  // Kafel stoi w tym samym miejscu we wszystkich fazach, żeby układ nie skakał.
  // Na niskim ekranie maleje, żeby przycisk pod porównaniem mieścił się bez przewijania (23,5rem = nagłówek gry + wiersze pod kaflem).
  return (
    <section className="flex flex-col gap-2">
      {counter}
      <div className="tile relative mx-auto aspect-square w-full max-w-[calc(100dvh-23.5rem)]">
        {(phase === "show" || phase === "reveal") &&
          view.rounds[index].map((d, i) => (
            <span
              key={i}
              className="absolute size-[5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
              style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
            />
          ))}
        {phase === "answer" && (
          // Na telefonie przy górnej krawędzi: przycisk musi zostać nad klawiaturą (numeryczna na iOS nie ma Entera).
          <form className="absolute inset-0 flex flex-col gap-3 p-4 sm:justify-center" onSubmit={submit}>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-fg-muted">Ile było kropek?</span>
              <input
                className="field text-center font-mono text-3xl"
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
            </label>
            <button type="submit" className="btn w-full text-bg" style={{ backgroundColor: color }} disabled={input === ""}>
              Zatwierdź
            </button>
          </form>
        )}
      </div>
      {phase === "reveal" && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p>
              Było <span className="font-mono font-semibold tabular-nums">{count}</span>, wpisałeś{" "}
              <span className="font-mono font-semibold tabular-nums">{answers[index]}</span>
            </p>
            <span className={`font-mono text-3xl font-semibold tabular-nums ${diff === 0 ? "text-success" : ""}`}>
              {diff === 0 ? "Idealnie" : signed(diff)}
            </span>
          </div>
          <button type="button" className="btn w-full text-bg" style={{ backgroundColor: color }} autoFocus onClick={next}>
            {answers.length < KROPKI_ROUNDS ? "Następna runda" : "Wyniki"}
          </button>
        </>
      )}
    </section>
  );
}
