import { type LobbyPlayer, QUIZ_DURATION_MS, type QuizMove } from "@mini-games/games";
import { Trophy } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Intro, Stats } from "../screens/ui.tsx";

/** Wspólny przebieg Stroopa i Szybkiego liczenia: 30 s pytań, cztery odpowiedzi, pomyłka blokuje na chwilę. */
interface Props {
  view: { players: string[]; results: Record<string, { times: number[]; errors: number }> };
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  winner?: string;
  /** Ekran instrukcji: co zrobić i podgląd; czas i punktacja są wspólne. */
  task: string;
  preview: ReactNode;
  /** Pytanie i cztery odpowiedzi dla pytania nr i; correct to indeks dobrej. */
  question: (i: number) => { prompt: ReactNode; options: ReactNode[]; correct: number };
  onMove: (move: QuizMove) => void;
  /** Trwa runda: ekran gry chowa wtedy limit platformy, żeby nie było dwóch zegarów. */
  onRound?: (on: boolean) => void;
}

/** Bez kary losowe klepanie byłoby szybsze niż myślenie. */
const BLOCK_MS = 1000;
const MIN_ANSWER = 150;
const MAX_ANSWER = 5000;

type Phase = "intro" | "play" | "wrong" | "sent";

/** Od sekundy w górę w sekundach („1,29 s”), poniżej w milisekundach. */
const duration = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2).replace(".", ",")} s` : `${ms} ms`);

/**
 * Wyniki: miejsce, trafienia, średni czas i błędy w kolumnach, pod spodem jak liczony jest ranking.
 * Gra, w której błędy odejmują punkty (Stój!), podaje `points`: kolumna „Punkty” zastępuje trafienia
 * (czwarta kolumna liczb nie mieści się na 360 px) i po niej idą miejsca; do tego własna notka.
 */
export function Results({
  view,
  me,
  players,
  ranking,
  winner,
  points,
  note = "Wygrywa najwięcej trafień, przy remisie niższy średni czas. Błędy nie odejmują trafień, każdy kosztował sekundę blokady.",
}: Pick<Props, "view" | "me" | "players" | "ranking" | "winner"> & { points?: (res: Props["view"]["results"][string]) => number; note?: string }) {
  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    const res = view.results[id];
    return {
      id,
      nick: p?.nick ?? "Gracz",
      color: p?.color,
      res,
      avg: res?.times.length ? Math.round(res.times.reduce((a, b) => a + b, 0) / res.times.length) : null,
    };
  });
  // Remis (te same trafienia albo punkty i średnia) to to samo miejsce.
  const main = (r: (typeof rows)[number]) => r.res && (points ? points(r.res) : r.res.times.length);
  const places: number[] = [];
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    places.push(prev && main(prev) === main(r) && prev.avg === r.avg ? places[i - 1] : i + 1);
  });

  return (
    <section className="tile flex flex-col gap-3 p-4">
      <table className="w-full border-separate border-spacing-y-1 whitespace-nowrap tabular-nums">
        <thead>
          <tr className="label text-right">
            <th className="w-full px-2 text-left font-normal">Gracz</th>
            <th className="px-1.5 font-normal">{points ? "Punkty" : "Trafienia"}</th>
            <th className="px-1.5 font-normal">Śr. czas</th>
            <th className="px-1.5 font-normal">Błędy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.id}
              className={`text-right ${r.id === winner ? "font-semibold" : ""}`}
              style={r.id === winner ? { backgroundColor: `color-mix(in srgb, ${r.color} 16%, transparent)` } : undefined}
            >
              <td className="max-w-0 rounded-l-inset px-2 py-1.5 text-left">
                <span className="flex items-center gap-2">
                  {r.id === winner ? (
                    <Trophy size={16} weight="fill" color={r.color} className="w-5 shrink-0" aria-label="Zwycięzca" />
                  ) : ranking ? (
                    <span className="w-5 shrink-0 font-mono" style={{ color: r.color }}>
                      {places[i]}.
                    </span>
                  ) : (
                    <span className="mx-[5px] size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                  )}
                  {/* Nick się zawija, nie ucina: kolumny liczb zostawiają mu mało miejsca. */}
                  <span className="min-w-0 whitespace-normal break-words">
                    {r.nick}
                    {r.id === me && <span className="text-fg-muted"> (ty)</span>}
                  </span>
                </span>
              </td>
              {!r.res ? (
                <td colSpan={3} className="rounded-r-inset px-2 text-fg-muted">
                  gra…
                </td>
              ) : (
                <>
                  {r.avg === null ? (
                    <td colSpan={2} className="px-1.5 text-fg-muted">
                      brak trafień
                    </td>
                  ) : (
                    <>
                      <td className="px-1.5">{main(r)}</td>
                      <td className="px-1.5">{duration(r.avg)}</td>
                    </>
                  )}
                  <td className={`rounded-r-inset pr-2 pl-1.5 ${r.res.errors > 0 ? "text-warning" : ""}`}>{r.res.errors}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm text-fg-muted">{note}</p>
    </section>
  );
}

/** Podgląd na ekranie instrukcji: pytanie i odpowiedzi, dobra co chwilę się zaznacza. */
export function QuizPreview({ prompt, options, correct }: { prompt: ReactNode; options: ReactNode[]; correct: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {prompt}
      <div className="flex gap-2">
        {options.map((option, i) => (
          <span key={i} className="relative rounded-inset border border-line bg-surface px-2 py-1 text-sm font-semibold">
            {option}
            {i === correct && (
              <span className="absolute -inset-px animate-[preview-half_2.4s_linear_infinite] rounded-inset border-2 border-success opacity-0 [animation-delay:-1.2s]" />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Quiz({ view, me, players, ranking, winner, task, preview, question, onMove, onRound }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(0);
  /** Ostatnio dotknięta odpowiedź: zielony błysk przy trafieniu, czerwony z potrząśnięciem przy pomyłce. */
  const [flash, setFlash] = useState<{ i: number; ok: boolean; id: number } | null>(null);
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
    const ok = option === question(index).correct;
    setFlash((f) => ({ i: option, ok, id: (f?.id ?? 0) + 1 }));
    if (ok) {
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

  useEffect(() => onRound?.(phase === "play" || phase === "wrong"), [phase]);

  if (!playing || phase === "sent") return <Results view={view} me={me} players={players} ranking={ranking} winner={winner} />;

  if (phase === "intro") {
    return (
      <Intro
        preview={preview}
        time={`${QUIZ_DURATION_MS / 1000} sekund`}
        task={task}
        score="Liczą się trafienia, pomyłka blokuje na sekundę"
        onStart={start}
      />
    );
  }

  const q = question(index);
  const left = Math.max(0, Math.ceil((QUIZ_DURATION_MS - (now - run.current.start)) / 1000));
  return (
    <div className="flex flex-1 flex-col gap-3">
      <Stats
        items={[
          { label: "Trafienia", value: run.current.times.length },
          { label: "Błędy", value: run.current.errors, warn: run.current.errors > 0 },
          { label: "Do końca", value: `${left} s` },
        ]}
      />
      <div className="tile flex min-h-32 flex-1 items-center justify-center p-4">
        {phase === "wrong" ? <span className="text-2xl font-semibold text-warning">Źle!</span> : q.prompt}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((option, i) => (
          <button
            // Klucz z błysku: przycisk montuje się od nowa i animacja startuje jeszcze raz.
            key={i === flash?.i ? `${i}-${flash.id}` : i}
            type="button"
            disabled={phase !== "play"}
            onPointerDown={() => answer(i)}
            className={`flex min-h-24 touch-none select-none items-center justify-center gap-2 rounded-tile border bg-surface text-xl font-semibold ${
              phase !== "wrong" ? "border-line" : i === flash?.i ? "border-warning" : "border-line opacity-40"
            } ${i === flash?.i ? (flash.ok ? "animate-[tile-hit_0.35s_ease-out]" : "animate-[tile-miss_0.35s_ease-out]") : ""}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
