import { type LobbyPlayer, REFLEKS_DURATION_MS, type RefleksView } from "@mini-games/games";
import { Trophy } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Intro, Stats } from "../screens/ui.tsx";

type Move = { type: "result"; times: number[]; falseStarts: number };

interface Props {
  view: RefleksView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  winner?: string;
  onMove: (move: Move) => void;
}

type Phase = "intro" | "wait" | "go" | "early" | "sent";

/** Reakcja szybsza niż 100 ms to zgadywanie: liczy się jak falstart (serwer i tak by ją odrzucił). */
const MIN_REACTION = 100;
const MAX_REACTION = 5000;

/** Wyniki: tabela (trafienia, średnia, najlepszy czas) i wykres czasów kolejnych reakcji w kolorach graczy. */
function Results({ view, me, players, ranking, winner }: Omit<Props, "onMove">) {
  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    const times = view.results[id]?.times;
    return {
      id,
      nick: p?.nick ?? "Gracz",
      color: p?.color,
      times,
      avg: times?.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
      best: times?.length ? Math.min(...times) : null,
    };
  });
  const all = rows.flatMap((r) => r.times ?? []);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const longest = Math.max(...rows.map((r) => r.times?.length ?? 0));
  const W = 300;
  const H = 100;
  const x = (i: number) => (i / (longest - 1)) * W;
  const y = (t: number) => (hi === lo ? H / 2 : H - ((t - lo) / (hi - lo)) * H);

  return (
    <section className="tile flex flex-col gap-4 p-4">
      <table className="w-full border-separate border-spacing-y-1 whitespace-nowrap tabular-nums">
        <thead>
          <tr className="label text-right">
            <th className="w-full px-2 text-left font-normal">Gracz</th>
            <th className="px-1.5 font-normal">Trafień</th>
            <th className="px-1.5 font-normal">Średnio</th>
            <th className="px-1.5 font-normal">Najlepszy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`text-right ${r.id === winner ? "font-semibold" : ""}`}
              style={r.id === winner ? { backgroundColor: `color-mix(in srgb, ${r.color} 16%, transparent)` } : undefined}
            >
              <td className="max-w-0 rounded-l-inset px-2 py-1.5 text-left">
                <span className="flex items-center gap-2">
                  {r.id === winner ? (
                    <Trophy size={16} weight="fill" color={r.color} className="shrink-0" aria-label="Zwycięzca" />
                  ) : (
                    <span className="mx-[3px] size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                  )}
                  <span className="truncate">{r.nick}</span>
                </span>
              </td>
              {!r.times ? (
                <td colSpan={3} className="rounded-r-inset px-2 text-fg-muted">
                  gra…
                </td>
              ) : r.avg === null ? (
                <td colSpan={3} className="rounded-r-inset px-2 text-fg-muted">
                  brak trafień
                </td>
              ) : (
                <>
                  <td className="px-1.5">{r.times.length}</td>
                  <td className="px-1.5">{r.avg} ms</td>
                  <td className="rounded-r-inset pr-2 pl-1.5">{r.best} ms</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {longest > 1 && (
        <figure className="flex flex-col gap-1">
          <figcaption className="label">Czasy kolejnych reakcji</figcaption>
          <div className="flex gap-2">
            <div className="flex flex-col justify-between text-right text-xs text-fg-muted tabular-nums">
              <span>{hi} ms</span>
              <span>{lo} ms</span>
            </div>
            <svg viewBox={`0 -4 ${W} ${H + 8}`} preserveAspectRatio="none" className="h-28 flex-1 border-l border-line" aria-hidden>
              {rows.map((r) => (
                <polyline
                  key={r.id}
                  points={(r.times ?? []).map((t, i) => `${x(i)},${y(t)}`).join(" ")}
                  fill="none"
                  stroke={r.color ?? "currentColor"}
                  strokeWidth={r.id === me ? 2.5 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </div>
        </figure>
      )}
    </section>
  );
}

/** Podgląd na ekranie instrukcji: pole co chwilę zmienia kolor. */
function Preview() {
  return (
    <>
      <span className="font-semibold text-fg-muted">Czekaj…</span>
      <span className="absolute inset-0 flex animate-[preview-quarter_2.4s_linear_infinite] items-center justify-center bg-accent font-semibold text-accent-fg opacity-0 [animation-delay:-1.2s]">
        Teraz!
      </span>
    </>
  );
}

export function Refleks({ view, me, players, ranking, winner, onMove }: Props) {
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

  if (!playing || phase === "sent") return <Results view={view} me={me} players={players} ranking={ranking} winner={winner} />;

  if (phase === "intro") {
    return (
      <Intro
        preview={<Preview />}
        time={`${REFLEKS_DURATION_MS / 1000} sekund`}
        task="Dotknij pola, gdy zmieni kolor"
        score="Liczą się trafienia; dotknięcie przed zmianą to falstart i strata czasu"
        onStart={start}
      />
    );
  }

  const left = Math.max(0, Math.ceil((REFLEKS_DURATION_MS - (now - run.current.start)) / 1000));
  return (
    <div className="flex flex-1 flex-col gap-3">
      <Stats
        items={[
          { label: "Trafienia", value: run.current.times.length },
          { label: "Falstarty", value: run.current.falseStarts, warn: run.current.falseStarts > 0 },
          { label: "Do końca", value: `${left} s` },
        ]}
      />
      <button
        type="button"
        onPointerDown={tap}
        className={`flex min-h-80 flex-1 touch-none select-none items-center justify-center rounded-tile border border-line text-2xl font-semibold ${
          phase === "go" ? "bg-accent text-accent-fg" : "bg-surface text-fg-muted"
        }`}
      >
        {phase === "go" ? "Teraz!" : phase === "early" ? "Falstart!" : last !== null ? `${last} ms` : "Czekaj…"}
      </button>
    </div>
  );
}
