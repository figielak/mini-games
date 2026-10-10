import { type LobbyPlayer, srodekDistance, SRODEK_ROUNDS, type SrodekPoint, type SrodekView } from "@mini-games/games";
import { type PointerEvent, useEffect, useState } from "react";
import { Intro, Scores, Stats } from "../screens/ui.tsx";

interface Props {
  view: SrodekView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; taps: SrodekPoint[] }) => void;
}

/** Tyle ms widać prawdziwy środek i własny punkt, zanim wskoczy następna runda. */
const REVEAL_MS = 1000;

const px = (n: number) => `${n.toFixed(1).replace(".", ",")} px`;
const unit = (v: number) => Math.min(1, Math.max(0, v));

/** Podgląd na ekranie instrukcji: odcinek, na którego środku miga punkt. */
function Preview() {
  return (
    <>
      <span className="h-0.5 w-40 -rotate-12 rounded-full bg-fg" />
      <span className="absolute top-1/2 left-1/2 size-3 -translate-1/2 animate-[preview-half_2s_linear_infinite] rounded-full bg-success opacity-0 [animation-delay:-1s]" />
    </>
  );
}

type Phase = "intro" | "play" | "reveal" | "sent";

export function Srodek({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [taps, setTaps] = useState<SrodekPoint[]>([]);
  const index = phase === "reveal" ? taps.length - 1 : taps.length;
  const color = players.find((p) => p.id === me)?.color;
  const distances = (list: SrodekPoint[]) => list.map((t, i) => srodekDistance(view.segments[i], t));

  useEffect(() => {
    if (phase !== "reveal") return;
    const id = setTimeout(() => {
      if (taps.length < SRODEK_ROUNDS) return setPhase("play");
      setPhase("sent");
      onMove({ type: "result", taps });
    }, REVEAL_MS);
    return () => clearTimeout(id);
  }, [phase]);

  function tap(e: PointerEvent<HTMLDivElement>) {
    if (phase !== "play") return;
    const box = e.currentTarget.getBoundingClientRect();
    setTaps([...taps, { x: unit((e.clientX - box.left) / box.width), y: unit((e.clientY - box.top) / box.height) }]);
    setPhase("reveal");
  }

  const over = ranking !== undefined;
  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: id in view.results ? px(view.results[id] / 10) : null };
  });

  if (!playing || phase === "sent") {
    // Na koniec odległości wszystkich; w trakcie tylko własne.
    const shown = (over ? (ranking ?? []) : [me]).filter((id) => view.taps[id]);
    return (
      <>
        <Scores rows={rows} />
        <p className="text-sm text-fg-muted">Suma odległości od środka z {SRODEK_ROUNDS} rund, mniej znaczy lepiej.</p>
        {shown.map((id) => (
          <section key={id} className="tile flex flex-col gap-2 p-3">
            <span className="text-sm">
              {rows.find((r) => r.id === id)?.nick}
              {id === me && <span className="text-fg-muted"> (ty)</span>}
            </span>
            {view.taps[id].length ? (
              <div className="grid grid-cols-5 gap-2">
                {distances(view.taps[id]).map((d, i) => (
                  <span key={i} className="rounded-inset border border-line py-1 text-center font-mono text-sm tabular-nums">
                    {d.toFixed(1).replace(".", ",")}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-fg-muted">Bez odpowiedzi</span>
            )}
          </section>
        ))}
      </>
    );
  }

  if (phase === "intro") {
    return (
      <Intro
        preview={<Preview />}
        time={`${SRODEK_ROUNDS} rund, w każdej jeden odcinek`}
        task="Dotknij dokładnie jego środka"
        score="Liczy się suma odległości od środka w px, mniej znaczy lepiej"
        onStart={() => setPhase("play")}
      />
    );
  }

  const { a, b } = view.segments[index];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const mine = phase === "reveal" ? taps[index] : null;

  // Na niskim ekranie kafel maleje, żeby wiersz pod nim mieścił się bez przewijania (21rem = nagłówek gry + wiersze nad i pod kaflem).
  return (
    <section className="flex flex-col gap-2">
      <Stats
        items={[
          { label: "Runda", value: `${index + 1}/${SRODEK_ROUNDS}` },
          { label: "Suma", value: px(distances(taps).reduce((s, d) => s + d, 0)) },
        ]}
      />
      <div className="tile relative mx-auto aspect-square w-full max-w-[calc(100dvh-21rem)] touch-none overflow-hidden select-none" onPointerDown={tap}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          <line x1={a.x * 100} y1={a.y * 100} x2={b.x * 100} y2={b.y * 100} className="stroke-fg" strokeWidth={0.8} strokeLinecap="round" />
          {mine && (
            <>
              <line x1={mid.x * 100} y1={mid.y * 100} x2={mine.x * 100} y2={mine.y * 100} className="stroke-fg-muted" strokeWidth={0.4} strokeDasharray="1 1" />
              <circle cx={mine.x * 100} cy={mine.y * 100} r={1.6} fill={color} />
              <circle cx={mid.x * 100} cy={mid.y * 100} r={1.6} className="fill-success" />
            </>
          )}
        </svg>
      </div>
      <p className="flex h-10 items-center justify-center" role="status">
        {mine ? (
          <span className="font-mono text-3xl font-semibold tabular-nums">{px(srodekDistance(view.segments[index], mine))}</span>
        ) : (
          <span className="text-sm text-fg-muted">Dotknij środka odcinka</span>
        )}
      </p>
    </section>
  );
}
