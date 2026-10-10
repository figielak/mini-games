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
/** Progi celności w umownych px: do PERFECT „Idealnie!” na zielono, powyżej CLOSE kolor ostrzeżenia. */
const PERFECT_PX = 5;
const CLOSE_PX = 20;
/** Lupa nad kaflem: średnica w % boku kafla i wycinek pola w jednostkach viewBox (100 = bok), czyli powiększenie ok. 1,7×. */
const LOUPE_SIZE = 40;
const LOUPE_SPAN = 24;
/** Połowa długości poprzecznej kreski na końcu odcinka, w jednostkach viewBox. */
const TICK = 2;

const num = (n: number) => n.toFixed(1).replace(".", ",");
const px = (n: number) => `${num(n)} px`;
const unit = (v: number) => Math.min(1, Math.max(0, v));
const grade = (d: number) =>
  d <= PERFECT_PX ? { text: "text-success", stroke: "stroke-success" } : d <= CLOSE_PX ? { text: "", stroke: "stroke-fg" } : { text: "text-warning", stroke: "stroke-warning" };

/** Odcinek z poprzecznymi kreskami na końcach, żeby było jednoznaczne, gdzie się zaczyna i kończy. */
function Segment({ a, b }: { a: SrodekPoint; b: SrodekPoint }) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = (-(b.y - a.y) / length) * TICK;
  const ny = ((b.x - a.x) / length) * TICK;
  return (
    <g className="stroke-fg" strokeWidth={0.8}>
      <line x1={a.x * 100} y1={a.y * 100} x2={b.x * 100} y2={b.y * 100} />
      {[a, b].map((p, i) => (
        <line key={i} x1={p.x * 100 - nx} y1={p.y * 100 - ny} x2={p.x * 100 + nx} y2={p.y * 100 + ny} />
      ))}
    </g>
  );
}

/** Podgląd na ekranie instrukcji: odcinek, na którego środku miga punkt. */
function Preview() {
  return (
    <>
      <span className="relative h-0.5 w-40 -rotate-12 bg-fg before:absolute before:-top-1.5 before:left-0 before:h-3.5 before:w-0.5 before:bg-fg after:absolute after:-top-1.5 after:right-0 after:h-3.5 after:w-0.5 after:bg-fg" />
      <span className="absolute top-1/2 left-1/2 size-3 -translate-1/2 animate-[preview-half_2s_linear_infinite] rounded-full bg-success opacity-0 [animation-delay:-1s]" />
    </>
  );
}

type Phase = "intro" | "play" | "reveal" | "sent";

export function Srodek({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [taps, setTaps] = useState<SrodekPoint[]>([]);
  /** Punkt pod przytrzymanym palcem; liczy się dopiero miejsce puszczenia. */
  const [aim, setAim] = useState<SrodekPoint | null>(null);
  /** Lupa tylko przy dotyku: kursor myszy niczego nie zasłania. */
  const [loupe, setLoupe] = useState(false);
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

  function point(e: PointerEvent<HTMLDivElement>): SrodekPoint {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: unit((e.clientX - box.left) / box.width), y: unit((e.clientY - box.top) / box.height) };
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (phase !== "play") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setLoupe(e.pointerType !== "mouse");
    setAim(point(e));
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    if (!aim) return;
    setTaps([...taps, point(e)]);
    setAim(null);
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
                  <span key={i} className={`rounded-inset border border-line py-1 text-center font-mono text-sm tabular-nums ${grade(d).text}`}>
                    {num(d)}
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
        task="Dotknij jego środka. Możesz przytrzymać i przesunąć, liczy się miejsce puszczenia"
        score="Liczy się suma odległości od środka w px, mniej znaczy lepiej"
        onStart={() => setPhase("play")}
      />
    );
  }

  const segment = view.segments[index];
  const mid = { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 };
  const mine = phase === "reveal" ? taps[index] : null;
  const error = mine ? srodekDistance(segment, mine) : 0;

  // Na niskim ekranie kafel maleje, żeby wiersz pod nim mieścił się bez przewijania (21rem = nagłówek gry + wiersze nad i pod kaflem).
  return (
    <section className="flex flex-col gap-2">
      <Stats
        items={[
          { label: "Runda", value: `${index + 1}/${SRODEK_ROUNDS}` },
          { label: "Suma błędów", value: px(distances(taps).reduce((s, d) => s + d, 0)) },
        ]}
      />
      <div
        className="tile relative mx-auto aspect-square w-full max-w-[calc(100dvh-21rem)] touch-none select-none"
        onPointerDown={down}
        onPointerMove={(e) => aim && setAim(point(e))}
        onPointerUp={up}
        onPointerCancel={() => setAim(null)}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          <Segment {...segment} />
          {aim && <circle cx={aim.x * 100} cy={aim.y * 100} r={1.6} fill="none" stroke={color} strokeWidth={0.6} />}
          {mine && (
            <>
              <line x1={mid.x * 100} y1={mid.y * 100} x2={mine.x * 100} y2={mine.y * 100} className={grade(error).stroke} strokeWidth={0.5} />
              <circle cx={mine.x * 100} cy={mine.y * 100} r={1.6} fill={color} />
              {/* Pierścień, nie pełna kropka: przy celnym dotknięciu oba punkty widać naraz. */}
              <circle cx={mid.x * 100} cy={mid.y * 100} r={2.6} fill="none" className={grade(error).stroke} strokeWidth={0.6} />
            </>
          )}
        </svg>
        {aim && loupe && (
          // Lupa nad kaflem, nie tuż nad palcem: tam zasłaniałaby drugą połowę odcinka. Idzie za palcem w poziomie, wycinek jest wyśrodkowany na palcu.
          <svg
            viewBox={`${aim.x * 100 - LOUPE_SPAN / 2} ${aim.y * 100 - LOUPE_SPAN / 2} ${LOUPE_SPAN} ${LOUPE_SPAN}`}
            className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] aspect-square -translate-x-1/2 rounded-full border border-line bg-surface shadow-lg"
            style={{
              width: `${LOUPE_SIZE}%`,
              left: `${Math.min(100 - LOUPE_SIZE / 2, Math.max(LOUPE_SIZE / 2, aim.x * 100))}%`,
            }}
            aria-hidden
          >
            <Segment {...segment} />
            <path d={`M${aim.x * 100 - 1.2} ${aim.y * 100}h2.4M${aim.x * 100} ${aim.y * 100 - 1.2}v2.4`} stroke={color} strokeWidth={0.3} />
          </svg>
        )}
      </div>
      <p className="flex h-10 items-center justify-center gap-3" role="status">
        {mine ? (
          <>
            {error <= PERFECT_PX && <span className="text-lg font-semibold text-success">Idealnie!</span>}
            <span className={`font-mono text-3xl font-semibold tabular-nums ${grade(error).text}`}>{px(error)}</span>
          </>
        ) : (
          <span className="text-sm text-fg-muted">Dotknij środka, przytrzymaj, żeby poprawić</span>
        )}
      </p>
    </section>
  );
}
