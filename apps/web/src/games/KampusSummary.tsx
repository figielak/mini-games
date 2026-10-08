import { KAMPUS_BOARD as BOARD, type KampusStats } from "@mini-games/games";
import { type ReactNode, useState } from "react";

interface Props {
  title: string;
  stats: KampusStats;
  /** Gracze w kolejności rankingu. */
  players: string[];
  nick: (id: string) => string;
  color: (id: string) => string;
  /** Majątek końcowy (jak w rankingu): ostatni punkt wykresu. */
  finalWealth: (id: string) => number;
  actions: ReactNode;
  onClose: () => void;
}

/** Podsumowanie partii: wykres majątku po rundach i kilka ciekawostek. */
export function KampusSummary({ title, stats, players, nick, color, finalWealth, actions, onClose }: Props) {
  // Ostatni punkt: majątek końcowy, chyba że koniec rundy już go zapisał (koniec po limicie rund).
  const series = players.map((id) => {
    const history = stats.wealth[id] ?? [];
    return { id, points: history.at(-1) === finalWealth(id) ? history : [...history, finalWealth(id)] };
  });

  const top = <K extends string | number>(record: Record<K, number>) =>
    (Object.entries(record) as [K, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
  const rent = top(stats.rentPaid);
  const tile = top(stats.tileIncome);
  const doubles = top(stats.doubles);
  const who = (id: string) => (
    <span className="font-semibold" style={{ color: color(id) }}>
      {nick(id)}
    </span>
  );

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-bg/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-label="Podsumowanie partii"
        className="flex w-[36rem] animate-[card-in_0.35s_ease-out] flex-col gap-2 rounded-inset border border-line bg-surface p-4 shadow-[0_16px_48px_rgb(0_0_0/0.7)]"
      >
        <h2 className="text-center text-lg font-semibold">{title}</h2>
        <div className="flex gap-4">
          <WealthChart series={series} nick={nick} color={color} />
          <dl className="flex w-40 shrink-0 flex-col gap-2 text-xs">
            {rent && (
              <div>
                <dt className="text-fg-muted">Najwięcej czynszu zapłacił(a)</dt>
                <dd>
                  {who(rent[0])} · {rent[1]} zł
                </dd>
              </div>
            )}
            {tile && (
              <div>
                <dt className="text-fg-muted">Najbardziej dochodowe pole</dt>
                <dd>
                  <span className="font-semibold">{BOARD[Number(tile[0])].name}</span> · {tile[1]} zł
                </dd>
              </div>
            )}
            {doubles && (
              <div>
                <dt className="text-fg-muted">Najwięcej dubletów</dt>
                <dd>
                  {who(doubles[0])} · {doubles[1]}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Plansza
          </button>
        </div>
      </div>
    </div>
  );
}

const W = 360;
const H = 150;
const PAD = { left: 34, right: 56, top: 8, bottom: 18 };

/** Majątek graczy po rundach: linia na gracza w jego kolorze, nick na końcu linii, stuknięcie pokazuje wartości. */
function WealthChart({
  series,
  nick,
  color,
}: {
  series: { id: string; points: number[] }[];
  nick: (id: string) => string;
  color: (id: string) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const count = Math.max(...series.map((s) => s.points.length));
  // Wykres zmian w czasie: oś od minimum do maksimum (co 50 zł), nie od zera, żeby linie nie ściskały się u góry.
  const values = series.flatMap((s) => s.points);
  const lo = Math.floor(Math.min(...values) / 50) * 50;
  const hi = Math.max(lo + 50, Math.ceil(Math.max(...values) / 50) * 50);
  const step = count > 1 ? (W - PAD.left - PAD.right) / (count - 1) : 0;
  const x = (i: number) => PAD.left + i * step;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];

  // Nicki przy końcach linii: rozsunięte, żeby się nie nakładały.
  const ends = series
    .map((s) => ({ id: s.id, y: y(s.points.at(-1) ?? 0) }))
    .sort((a, b) => a.y - b.y)
    .reduce<{ id: string; y: number }[]>((acc, e) => [...acc, { ...e, y: Math.max(e.y, (acc.at(-1)?.y ?? -Infinity) + 11) }], []);

  const label = (i: number) => (i === count - 1 ? "koniec" : `runda ${i + 1}`);

  return (
    <figure className="m-0 flex-1">
      {/* Legenda zawsze (kolor nie może być jedynym nośnikiem tożsamości). */}
      <figcaption className="mb-1 flex flex-wrap gap-x-3 text-[11px] text-fg-muted">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: color(s.id) }} aria-hidden />
            {nick(s.id)}
          </span>
        ))}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none overflow-visible"
        role="img"
        aria-label={`Majątek graczy po rundach. ${series.map((s) => `${nick(s.id)}: ${s.points.at(-1)} zł na koniec`).join(", ")}.`}
        onPointerMove={(e) => {
          // Współrzędne w układzie SVG (uwzględniają obrót .landscape w pionie i zoom sceny).
          const ctm = e.currentTarget.getScreenCTM();
          if (!ctm) return;
          const px = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()).x;
          setHover(step ? Math.min(count - 1, Math.max(0, Math.round((px - PAD.left) / step))) : 0);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={PAD.left - 4} y={y(t) + 3} textAnchor="end" className="fill-fg-muted font-mono text-[9px]">
              {t}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 4} className="fill-fg-muted text-[9px]">
          start
        </text>
        <text x={W - PAD.right} y={H - 4} textAnchor="end" className="fill-fg-muted text-[9px]">
          koniec
        </text>

        {series.map((s) => (
          <polyline
            key={s.id}
            points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            fill="none"
            stroke={color(s.id)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {series.map((s) => (
          <circle key={s.id} cx={x(s.points.length - 1)} cy={y(s.points.at(-1) ?? 0)} r={4} fill={color(s.id)} stroke="var(--color-surface)" strokeWidth={2} />
        ))}
        {ends.map((e) => (
          <text key={e.id} x={W - PAD.right + 8} y={e.y + 3} className="fill-fg text-[10px] font-medium">
            {nick(e.id)}
          </text>
        ))}

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-fg-muted)" strokeDasharray="2 3" />
            {series.map(
              (s) =>
                s.points[hover] !== undefined && (
                  <circle key={s.id} cx={x(hover)} cy={y(s.points[hover])} r={4} fill={color(s.id)} stroke="var(--color-surface)" strokeWidth={2} />
                ),
            )}
          </g>
        )}
      </svg>
      {/* Wartości w punkcie pod palcem: tekst w kolorach tekstu, kolor gracza tylko na kropce. */}
      <p className="h-4 text-[11px] text-fg-muted">
        {hover !== null && (
          <>
            {label(hover)}:{" "}
            {series
              .filter((s) => s.points[hover] !== undefined)
              .map((s) => (
                <span key={s.id} className="mr-2 inline-flex items-center gap-1 text-fg">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: color(s.id) }} aria-hidden />
                  {nick(s.id)} {s.points[hover]} zł
                </span>
              ))}
          </>
        )}
      </p>
    </figure>
  );
}
