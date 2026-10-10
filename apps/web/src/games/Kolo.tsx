import { KOLO_ATTEMPTS, KOLO_MAX_POINTS, koloJudge, type KoloPoint, type KoloView, type LobbyPlayer } from "@mini-games/games";
import { type PointerEvent, useRef, useState } from "react";
import { Stats } from "../screens/ui.tsx";

interface Props {
  view: KoloView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; points: KoloPoint[] }) => void;
}

/** Nowy punkt dopiero po przesunięciu o 0,5% płótna: punkty wychodzą równomiernie, a linia nie jest kanciasta. */
const MIN_STEP = 0.005;
/** Odchylenie od dopasowanego okręgu (w częściach promienia), od którego linia jest całkiem czerwona. */
const RED_AT = 0.1;
/** Wysyłamy z zapasem poniżej limitu serwera. */
const SEND_POINTS = KOLO_MAX_POINTS / 2;

const HINTS = {
  unfinished: "Niedokończone koło, narysuj jeszcze raz.",
  small: "Za małe, narysuj większe.",
};

const tenths = (score: number) => (score / 10).toFixed(1).replace(".", ",");
const percent = (score: number) => `${tenths(score)}%`;
/** Gładka linia: krzywe kwadratowe przez środki odcinków, punkty rysunku są punktami kontrolnymi. */
const smooth = (points: KoloPoint[]) =>
  `M${points[0]}${points
    .slice(1, -1)
    .map((p, i) => `Q${p} ${(p[0] + points[i + 2][0]) / 2},${(p[1] + points[i + 2][1]) / 2}`)
    .join("")}L${points[points.length - 1]}`;
const clamp = (v: number) => Math.min(1, Math.max(0, v));

function Drawing({ points, color, faint }: { points: KoloPoint[]; color?: string; faint?: boolean }) {
  if (!points.length) return null;
  return (
    <path
      d={smooth(points)}
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={0.015}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={faint ? 0.45 : 1}
    />
  );
}

type Circle = { cx: number; cy: number; r: number };

/** Idealny okrąg dopasowany do rysunku: cienka przerywana linia. */
function Ideal({ cx, cy, r }: Circle) {
  return <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={0.004} strokeDasharray="0.02 0.015" opacity={0.6} />;
}

/** Rysunek po próbie: idealny okrąg przerywaną linią, a odcinki od zielonego (blisko niego) do czerwonego (daleko). */
function Judged({ points, circle: { cx, cy, r } }: { points: KoloPoint[]; circle: Circle }) {
  return (
    <>
      <Ideal cx={cx} cy={cy} r={r} />
      {points.slice(1).map(([x, y], i) => {
        const off = Math.abs(Math.hypot(x - cx, y - cy) - r) / r;
        return (
          <line
            key={i}
            x1={points[i][0]}
            y1={points[i][1]}
            x2={x}
            y2={y}
            stroke={`hsl(${140 * (1 - Math.min(1, off / RED_AT))} 80% 55%)`}
            strokeWidth={0.015}
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}

export function Kolo({ view, me, players, ranking, onMove }: Props) {
  const attempts = view.attempts[me] ?? 0;
  const playing = view.players.includes(me) && attempts < KOLO_ATTEMPTS;
  const best = view.best[me];
  const [points, setPoints] = useState<KoloPoint[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  /** Ostatnia oceniona próba, widoczna na płótnie do następnego dotknięcia. */
  const [last, setLast] = useState<{ points: KoloPoint[]; circle: Circle; score: number; note: string; record: boolean } | null>(null);
  const drawn = useRef<KoloPoint[]>([]);
  /** Rysuje tylko pierwszy palec, kolejne są ignorowane. */
  const finger = useRef<number | null>(null);
  const color = (id: string) => players.find((p) => p.id === id)?.color;

  function at(e: { clientX: number; clientY: number }, r: DOMRect): KoloPoint {
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
  }

  function down(e: PointerEvent<SVGSVGElement>) {
    if (finger.current !== null) return;
    finger.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawn.current = [at(e, e.currentTarget.getBoundingClientRect())];
    setPoints(drawn.current);
    setHint(null);
    setLast(null);
  }

  function move(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerId !== finger.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    // Przeglądarka skleja szybkie ruchy w jedno zdarzenie; bierzemy wszystkie, żeby łuk nie robił się wielokątem.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const next = [...drawn.current];
    for (const ev of events.length ? events : [e]) {
      const p = at(ev, r);
      const [x, y] = next[next.length - 1];
      if (Math.hypot(p[0] - x, p[1] - y) >= MIN_STEP) next.push(p);
    }
    if (next.length === drawn.current.length) return;
    drawn.current = next;
    setPoints(next);
  }

  function up(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerId !== finger.current) return;
    finger.current = null;
    const step = Math.ceil(drawn.current.length / SEND_POINTS);
    const sent = drawn.current.filter((_, i) => i % step === 0);
    // Niedokończone koło nie idzie na serwer, więc przypadkowe dotknięcie nie spala próby.
    const { status, score, points: cut, circle } = koloJudge(sent);
    if (status !== "ok" || !circle) return setHint(HINTS[status === "small" ? "small" : "unfinished"]);
    onMove({ type: "result", points: sent });
    // Oceniony rysunek zostaje do następnego dotknięcia, potem w tle wraca przygaszona najlepsza próba (z serwera).
    drawn.current = [];
    setPoints([]);
    const diff = best ? score - best.score : 0;
    const note = !best ? "" : diff > 0 ? "Nowy rekord!" : diff === 0 ? "Tyle co najlepsza" : `−${tenths(-diff)} pkt od najlepszej`;
    setLast({ points: cut, circle, score, note, record: diff > 0 });
  }

  /** Gest systemowy (np. na iOS) przerywa rysowanie: zaczynamy od nowa zamiast wysyłać połówkę. */
  function cancel(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerId !== finger.current) return;
    finger.current = null;
    drawn.current = [];
    setPoints([]);
  }

  if (playing) {
    return (
      <section className="flex flex-col gap-3">
        <p className="text-fg-muted">Narysuj palcem jednym ruchem jak najdoskonalszy okrąg. Liczy się najlepsza z {KOLO_ATTEMPTS} prób.</p>
        <Stats
          items={[
            { label: "Próba", value: `${attempts + 1}/${KOLO_ATTEMPTS}` },
            { label: "Najlepsza", value: best ? percent(best.score) : "-" },
          ]}
        />
        <div className="relative">
          <svg
            viewBox="0 0 1 1"
            className="block aspect-square w-full touch-none select-none rounded-tile border border-line bg-surface [-webkit-touch-callout:none]"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={cancel}
          >
            {last ? (
              <Judged points={last.points} circle={last.circle} />
            ) : (
              <>
                {/* Kropka na środku płótna pomaga wyobrazić sobie koło; ocena nie zależy od położenia. */}
                <circle cx={0.5} cy={0.5} r={0.008} fill="currentColor" opacity={0.35} />
                {best && <Drawing points={best.points} color={color(me)} faint />}
                <Drawing points={points} color={color(me)} />
              </>
            )}
          </svg>
          {last ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="font-mono text-5xl">{percent(last.score)}</span>
              <span className={last.record ? "text-success" : "text-fg-muted"}>{last.note}</span>
            </div>
          ) : (
            best && <span className="pointer-events-none absolute left-3 top-2 text-xs text-fg-muted">Przygaszony ślad: najlepsza próba</span>
          )}
        </div>
        {/* Stała wysokość (dwie linijki), żeby przycisk pod spodem nie skakał. */}
        <p className={`min-h-10 text-center text-sm ${hint ? "text-warning" : "text-fg-muted"}`}>
          {hint ?? (last && "Przerywana linia to idealne koło. Zielony: blisko niego, czerwony: daleko.")}
        </p>
        {best && (
          <button type="button" className="btn btn-ghost w-full" onClick={() => onMove({ type: "result", points: [] })}>
            Zostaw najlepszą i zakończ
          </button>
        )}
      </section>
    );
  }

  const order = ranking ?? view.players;
  const rows = order.map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: (view.attempts[id] ?? 0) >= KOLO_ATTEMPTS ? percent(view.best[id].score) : null };
  });

  // Karta na gracza w kolejności rankingu: wynik w nagłówku, pod spodem miniatury (bez osobnej tabeli, żeby nie powtarzać wyniku).
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.id} className="tile flex flex-col gap-2 p-3">
          <div className="flex items-center gap-3">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {r.nick}
              {r.me && <span className="text-fg-muted"> (ty)</span>}
            </span>
            <span className={`font-mono ${r.score === null ? "text-fg-muted" : "text-2xl font-semibold tabular-nums"}`}>{r.score ?? "gra…"}</span>
          </div>
          {r.score !== null && (
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["Najlepsza", view.best[r.id]],
                  ["Najgorsza", view.worst[r.id]],
                ] as const
              ).map(([label, attempt]) => {
                // Stan nie trzyma dopasowanego okręgu; liczymy go z punktów tylko dla najlepszej próby.
                const ideal = label === "Najlepsza" && koloJudge(attempt.points).circle;
                return (
                  <figure key={label} className="flex flex-col gap-1">
                    <svg viewBox="0 0 1 1" className="aspect-square w-full rounded-inset bg-bg" aria-label={`${label} próba gracza ${r.nick}`}>
                      {ideal && <Ideal {...ideal} />}
                      <Drawing points={attempt.points} color={r.color} />
                    </svg>
                    <figcaption className="flex justify-between gap-2 text-sm text-fg-muted">
                      {label}
                      {/* Najlepszy wynik jest już w nagłówku karty. */}
                      {label === "Najgorsza" && <span className="font-mono text-fg">{percent(attempt.score)}</span>}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
