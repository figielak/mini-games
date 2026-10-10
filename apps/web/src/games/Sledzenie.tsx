import { BALLS, type LobbyPlayer, MOVE_MS, RADIUS, ROUNDS, SHOW_MS, sledzeniePosition, type SledzenieView, TARGETS } from "@mini-games/games";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { Intro, Scores, Stats } from "../screens/ui.tsx";

interface Props {
  view: SledzenieView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; picks: number[][] }) => void;
}

type Phase = "intro" | "wait" | "show" | "move" | "pick" | "reveal" | "sent";

/** Fazy na zegarze: kulki bez podświetlenia, podświetlone cele, pokazane prawdziwe cele. */
const TIMED: Partial<Record<Phase, number>> = { wait: 700, show: SHOW_MS, reveal: 1000 };

const SIZE = `${RADIUS * 200}%`;

const isTarget = (i: number) => i < TARGETS;

/** „1 runda”, „3 rundy”, „7 rund”. */
const roundsLabel = (n: number) => `${n} ${n === 1 ? "runda" : n % 10 >= 2 && n % 10 <= 4 && (n < 12 || n > 14) ? "rundy" : "rund"}`;

/** Podgląd na ekranie instrukcji: osiem kulek, trzy na zmianę podświetlone. */
const PREVIEW_DOTS = [
  [18, 30], [48, 66], [78, 34], [32, 72], [62, 24], [88, 70], [10, 66], [40, 36],
];

function Preview({ color }: { color?: string }) {
  return (
    <>
      {PREVIEW_DOTS.map(([x, y], i) => (
        <span key={x} className="absolute size-3.5 overflow-hidden rounded-full bg-fg" style={{ left: `${x}%`, top: `${y}%` }}>
          {isTarget(i) && <span className="absolute inset-0 animate-[preview-half_3s_linear_infinite]" style={{ backgroundColor: color }} />}
        </span>
      ))}
    </>
  );
}

export function Sledzenie({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  /** Wskazania z zakończonych rund i zaznaczenie w bieżącej. */
  const [picks, setPicks] = useState<number[][]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const color = players.find((p) => p.id === me)?.color;

  const round = Math.min(phase === "reveal" ? picks.length - 1 : picks.length, ROUNDS - 1);
  const balls = view.rounds[round];
  const failed = phase === "reveal" && !picked.every(isTarget);

  useEffect(() => {
    const ms = TIMED[phase];
    if (ms === undefined) return;
    const id = setTimeout(() => {
      if (phase === "wait") return setPhase("show");
      if (phase === "show") return setPhase("move");
      if (failed || picks.length >= ROUNDS) {
        setPhase("sent");
        return onMove({ type: "result", picks });
      }
      setPicked([]);
      setPhase("wait");
    }, ms);
    return () => clearTimeout(id);
  }, [phase]);

  // Ruch ustawia pozycje wprost w DOM (bez stanu Reacta na klatkę), z tego samego wzoru co serwer.
  useEffect(() => {
    if (phase !== "move") return;
    const start = performance.now();
    let id = requestAnimationFrame(function frame(now) {
      const t = now - start;
      if (t >= MOVE_MS) return setPhase("pick");
      balls.forEach((ball, i) => {
        const el = dots.current[i];
        if (!el) return;
        const p = sledzeniePosition(ball, round, t);
        el.style.left = `${p.x * 100}%`;
        el.style.top = `${p.y * 100}%`;
      });
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [phase]);

  const stopped = phase === "pick" || phase === "reveal";
  const at = balls.map((ball) => (stopped ? sledzeniePosition(ball, round, MOVE_MS) : ball));

  // Dotyk łapie cały kafel i wybiera najbliższą kulkę: pole dotyku jest większe niż kulka i nigdy nie nachodzi na sąsiada.
  function tap(e: PointerEvent<HTMLDivElement>) {
    if (phase !== "pick") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const far = at.map((p) => Math.hypot(p.x - x, p.y - y));
    const i = far.indexOf(Math.min(...far));
    if (far[i] > 2 * RADIUS) return;
    const next = picked.includes(i) ? picked.filter((n) => n !== i) : [...picked, i];
    setPicked(next);
    if (next.length < TARGETS) return;
    setPicks([...picks, next]);
    setPhase("reveal");
    if (!next.every(isTarget)) navigator.vibrate?.(60);
  }

  if (!playing || phase === "sent") {
    const rows = (ranking ?? view.players).map((id) => {
      const p = players.find((pl) => pl.id === id);
      const r = view.results[id];
      return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: r ? `${roundsLabel(r.rounds)}${r.hits ? ` +${r.hits}` : ""}` : null };
    });
    return (
      <>
        <Scores rows={rows} />
        <p className="text-sm text-fg-muted">
          Liczą się rundy bez pomyłki (najwyżej {ROUNDS}). Przy remisie wygrywa więcej trafionych kulek w rundzie z pomyłką (liczba po plusie).
        </p>
      </>
    );
  }

  if (phase === "intro") {
    return (
      <Intro
        preview={<Preview color={color} />}
        time={`Do ${ROUNDS} rund, kulki lecą coraz szybciej`}
        task={`Zapamiętaj ${TARGETS} podświetlone kulki z ${BALLS} i wskaż je, gdy się zatrzymają`}
        score="Pierwsza pomyłka kończy partię, liczą się zaliczone rundy"
        onStart={() => setPhase("wait")}
      />
    );
  }

  const status = phase === "move" ? "Śledź" : phase === "pick" ? `Wskaż ${picked.length}/${TARGETS}` : phase === "reveal" ? (failed ? "Pomyłka" : "Dobrze") : "Patrz";

  return (
    <section className="flex flex-col gap-2">
      <Stats
        items={[
          { label: "Runda", value: `${round + 1}/${ROUNDS}` },
          { label: "Teraz", value: status, warn: failed },
        ]}
      />
      <div className="tile relative mx-auto aspect-square w-full max-w-[calc(100dvh-19rem)] touch-none select-none overflow-hidden" onPointerDown={tap}>
        {balls.map((_, i) => {
          const selected = picked.includes(i);
          const lit = selected || (phase === "show" && isTarget(i));
          return (
            <span
              key={i}
              ref={(el) => {
                dots.current[i] = el;
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${lit ? "" : "bg-fg"}`}
              style={{
                left: `${at[i].x * 100}%`,
                top: `${at[i].y * 100}%`,
                width: SIZE,
                height: SIZE,
                backgroundColor: lit ? color : undefined,
                // Po rundzie: prawdziwe cele w pierścieniu, złe wskazania przygaszone.
                opacity: phase === "reveal" && selected && !isTarget(i) ? 0.3 : 1,
                outline: phase === "reveal" && isTarget(i) ? "3px solid var(--color-success)" : undefined,
                outlineOffset: 2,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
