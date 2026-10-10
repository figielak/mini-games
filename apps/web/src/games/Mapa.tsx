import { type LobbyPlayer, MAPA_ASPECT, MAPA_OUTLINE, MAPA_ROUNDS, mapaError, type MapaPoint, mapaPlace, type MapaView } from "@mini-games/games";
import { Fragment, type PointerEvent, useEffect, useState } from "react";
import { Intro, Scores, Stats } from "../screens/ui.tsx";

interface Props {
  view: MapaView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; taps: MapaPoint[] }) => void;
}

/** Tyle ms widać prawdziwe miejsce miasta i odległość, zanim wskoczy następna runda. */
const REVEAL_MS = 1500;
/** Progi celności w km: do PERFECT „Idealnie!” na zielono, powyżej CLOSE kolor ostrzeżenia. */
const PERFECT = 20;
const CLOSE = 150;
/** Pole w jednostkach viewBox: wysokość 100, szerokość z proporcji pola. */
const W = 100 * MAPA_ASPECT;
const H = 100;

const at = (p: MapaPoint) => ({ cx: p.x * W, cy: p.y * H });
const CONTOUR = `M${MAPA_OUTLINE.map(([lon, lat]) => {
  const { cx, cy } = at(mapaPlace({ lat, lon }));
  return `${cx.toFixed(1)} ${cy.toFixed(1)}`;
}).join("L")}Z`;

const km = (n: number) => `${n} km`;
const grade = (d: number) =>
  d <= PERFECT ? { text: "text-success", stroke: "stroke-success" } : d <= CLOSE ? { text: "", stroke: "stroke-fg" } : { text: "text-warning", stroke: "stroke-warning" };

function Contour() {
  return <path d={CONTOUR} className="fill-bg stroke-fg-muted" strokeWidth={0.6} strokeLinejoin="round" />;
}

/** Podgląd na ekranie instrukcji: kontur, na którym miga znacznik. */
function Preview() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28" aria-hidden>
      <Contour />
      <circle cx={W * 0.62} cy={H * 0.45} r={4} className="animate-[preview-half_2s_linear_infinite] fill-success opacity-0 [animation-delay:-1s]" />
    </svg>
  );
}

type Phase = "intro" | "play" | "reveal" | "sent";

export function Mapa({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [taps, setTaps] = useState<MapaPoint[]>([]);
  /** Znacznik bieżącej rundy; można go przenosić aż do „Zatwierdź”. */
  const [pin, setPin] = useState<MapaPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const index = phase === "reveal" ? taps.length - 1 : taps.length;
  const color = players.find((p) => p.id === me)?.color;
  const distances = (list: MapaPoint[]) => list.map((t, i) => mapaError(view.cities[i], t));

  useEffect(() => {
    if (phase !== "reveal") return;
    const id = setTimeout(() => {
      if (taps.length < MAPA_ROUNDS) return setPhase("play");
      setPhase("sent");
      onMove({ type: "result", taps });
    }, REVEAL_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Przycięcie do pola: przeciągnięty palec może wyjechać za kafel, a serwer odrzuca punkt poza 0-1.
  function point(e: PointerEvent<HTMLDivElement>): MapaPoint {
    const box = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return { x: clamp((e.clientX - box.left) / box.width), y: clamp((e.clientY - box.top) / box.height) };
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (phase !== "play") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setPin(point(e));
  }

  function confirm() {
    if (!pin || phase !== "play") return;
    setTaps([...taps, pin]);
    setPin(null);
    setPhase("reveal");
  }

  const over = ranking !== undefined;
  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: id in view.results ? km(view.results[id]) : null };
  });

  if (!playing || phase === "sent") {
    // Na koniec rundy wszystkich w jednej tabeli; w trakcie tylko własne.
    const shown = rows.filter((r) => (over || r.me) && view.taps[r.id]).map((r) => ({ ...r, errors: distances(view.taps[r.id]) }));
    const played = shown.filter((r) => r.errors.length);
    /** Kto wygrał rundę: jedyny najmniejszy błąd, przy remisie albo jednym graczu nikt. */
    const best = (round: number) => {
      const sorted = [...played].sort((a, b) => a.errors[round] - b.errors[round]);
      return sorted.length > 1 && sorted[0].errors[round] < sorted[1].errors[round] ? sorted[0].id : null;
    };
    return (
      <>
        <Scores rows={rows} />
        <p className="text-sm text-fg-muted">Suma odległości z {MAPA_ROUNDS} rund, mniej znaczy lepiej.</p>
        {shown.length > 0 && (
          <section className="tile flex flex-col gap-2 p-3">
            <div className="grid grid-cols-10 gap-1 text-center font-mono text-[11px] tabular-nums">
              {view.cities.map((_, i) => (
                <span key={i} className="text-fg-muted">
                  {i + 1}
                </span>
              ))}
              {shown.map((r) => (
                <Fragment key={r.id}>
                  <span className="col-span-10 mt-1 flex items-center gap-2 text-left font-sans text-sm">
                    <span className="size-2 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                    {r.nick}
                    {r.me && <span className="text-fg-muted">(ty)</span>}
                    {!r.errors.length && <span className="text-fg-muted">bez odpowiedzi</span>}
                  </span>
                  {r.errors.map((d, i) => (
                    <span
                      key={i}
                      className={`rounded-md border py-1 ${grade(d).text} ${d <= PERFECT ? "font-semibold" : ""} ${best(i) === r.id ? "" : "border-line"}`}
                      style={best(i) === r.id ? { borderColor: r.color, backgroundColor: `color-mix(in srgb, ${r.color} 28%, transparent)` } : undefined}
                    >
                      {d}
                    </span>
                  ))}
                </Fragment>
              ))}
            </div>
            <ol className="grid grid-cols-2 gap-x-3 text-xs text-fg-muted">
              {view.cities.map((c, i) => (
                <li key={c.name} className="truncate">
                  <span className="font-mono tabular-nums">{i + 1}.</span> {c.name}
                </li>
              ))}
            </ol>
            <p className="text-xs text-fg-muted">
              Odległość w każdej rundzie (km){played.length > 1 && "; tło w kolorze gracza ma najlepszy w rundzie"}. Zielony: do {PERFECT} km, czerwony: ponad {CLOSE} km.
            </p>
          </section>
        )}
      </>
    );
  }

  if (phase === "intro") {
    return (
      <Intro
        preview={<Preview />}
        time={`${MAPA_ROUNDS} rund, w każdej jedno miasto`}
        task="Dotknij mapy tam, gdzie leży miasto, popraw znacznik i zatwierdź"
        score="Liczy się suma odległości w km, mniej znaczy lepiej"
        onStart={() => setPhase("play")}
      />
    );
  }

  const city = view.cities[index];
  const mine = phase === "reveal" ? taps[index] : null;
  const error = mine ? mapaError(city, mine) : 0;
  const target = at(mapaPlace(city));

  // Na niskim ekranie kafel maleje, żeby przycisk pod nim mieścił się bez przewijania (24rem = nagłówek gry + wiersze nad i pod kaflem).
  return (
    <section className="flex flex-col gap-2">
      <Stats
        items={[
          { label: "Runda", value: `${index + 1}/${MAPA_ROUNDS}` },
          { label: "Suma", value: km(distances(taps).reduce((s, d) => s + d, 0)) },
        ]}
      />
      <h2 className="text-center text-2xl leading-tight font-semibold">{city.name}</h2>
      <div
        className="tile relative mx-auto w-full touch-none overflow-hidden select-none"
        style={{ aspectRatio: MAPA_ASPECT, maxWidth: `calc((100dvh - 24rem) * ${MAPA_ASPECT})` }}
        onPointerDown={down}
        onPointerMove={(e) => dragging && phase === "play" && setPin(point(e))}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
          <Contour />
          {pin && (
            <>
              <circle {...at(pin)} r={1.4} fill={color} />
              <circle {...at(pin)} r={3.4} fill="none" stroke={color} strokeWidth={0.6} />
            </>
          )}
          {mine && (
            <>
              <line x1={target.cx} y1={target.cy} x2={at(mine).cx} y2={at(mine).cy} className={grade(error).stroke} strokeWidth={0.8} />
              <circle {...at(mine)} r={1.4} fill={color} />
              {/* Pierścień, nie pełna kropka: przy celnym wskazaniu oba punkty widać naraz. */}
              <circle
                {...target}
                r={2.6}
                fill="none"
                className={`origin-center animate-[stone-pop_0.35s_ease-out] [transform-box:fill-box] ${grade(error).stroke}`}
                strokeWidth={0.8}
              />
            </>
          )}
        </svg>
      </div>
      <div className="flex h-12 items-center justify-center gap-3" role="status">
        {mine ? (
          <>
            {error <= PERFECT && <span className="text-lg font-semibold text-success">Idealnie!</span>}
            <span className={`font-mono text-3xl font-semibold tabular-nums ${grade(error).text}`}>{km(error)}</span>
          </>
        ) : (
          <button type="button" className="btn btn-primary w-full" disabled={!pin} onClick={confirm}>
            {pin ? "Zatwierdź" : "Dotknij mapy"}
          </button>
        )}
      </div>
    </section>
  );
}
