import { type LobbyPlayer, WIEZA_BASE, WIEZA_LEVELS, WIEZA_MAX_STOP_MS, wiezaBuild, wiezaLeft, type WiezaView } from "@mini-games/games";
import { useEffect, useRef, useState } from "react";
import { Intro, Scores, Stats } from "../screens/ui.tsx";

interface Props {
  view: WiezaView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; stops: number[] } | { type: "progress"; height: number }) => void;
}

type Phase = "intro" | "play" | "over" | "sent";

/** Tyle pięter widać naraz; wyższa wieża zjeżdża w dół. */
const VISIBLE = 8;
const ROW = 100 / VISIBLE;
/** Tyle widać koniec partii (pudło albo ostatnie piętro), zanim pojawi się wynik. */
const OVER_MS = 1000;

/** „1 piętro”, „3 piętra”, „7 pięter”. */
const levelsLabel = (n: number) => `${n} ${n === 1 ? "piętro" : n % 10 >= 2 && n % 10 <= 4 && (n < 12 || n > 14) ? "piętra" : "pięter"}`;
const percent = (width: number) => `${Math.round(width * 100)}%`;

/** Podgląd na ekranie instrukcji: dwa klocki i trzeci, który miga nad nimi. */
function Preview({ color }: { color?: string }) {
  return (
    <>
      <span className="absolute bottom-[18%] left-[30%] h-[18%] w-[40%] rounded-sm" style={{ backgroundColor: color }} />
      <span className="absolute bottom-[36%] left-[34%] h-[18%] w-[36%] rounded-sm opacity-80" style={{ backgroundColor: color }} />
      <span className="absolute bottom-[54%] left-[40%] h-[18%] w-[30%] animate-[preview-half_3s_linear_infinite] rounded-sm" style={{ backgroundColor: color }} />
    </>
  );
}

export function Wieza({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  /** Czasy zatrzymania kolejnych klocków; wieżę liczy z nich ten sam wzór co serwer. */
  const [stops, setStops] = useState<number[]>([]);
  const moving = useRef<HTMLSpanElement | null>(null);
  const started = useRef(0);
  const color = players.find((p) => p.id === me)?.color;

  const tower = wiezaBuild(view.sides, stops);
  const level = stops.length;
  const missed = tower.height < stops.length;

  // Ostatnio zatrzymany klocek: `under` to ten, na który spadał, `at` to miejsce, w którym stanął.
  const under = tower.blocks[stops.length - 2] ?? WIEZA_BASE;
  const at = stops.length > 0 ? wiezaLeft(view.sides[level - 1], level - 1, under.width, stops[level - 1]) : under.left;
  const perfect = stops.length > 0 && !missed && tower.width === under.width;
  // To, co odpadło: po pudle cały klocek, inaczej kawałek wystający z lewej albo z prawej.
  const cut =
    stops.length === 0 || perfect
      ? null
      : missed
        ? { left: at, width: under.width }
        : { left: at < under.left ? at : under.left + tower.width, width: under.width - tower.width };
  const verdict = missed ? "Pudło" : perfect ? "Idealnie!" : percent(tower.width / under.width);
  /** Trafienia idealne z rzędu. */
  const streak = missed ? 0 : tower.blocks.reduce((n, b, i) => (b.width === (tower.blocks[i - 1] ?? WIEZA_BASE).width ? n + 1 : 0), 0);

  function drop(t: number) {
    const next = [...stops, t];
    const built = wiezaBuild(view.sides, next);
    setStops(next);
    if (built.height < next.length) navigator.vibrate?.(60);
    else if (next.length < WIEZA_LEVELS) onMove({ type: "progress", height: built.height });
    if (built.height < next.length || next.length >= WIEZA_LEVELS) setPhase("over");
  }

  // Ruch ustawia pozycję wprost w DOM (bez stanu Reacta na klatkę), z tego samego wzoru co serwer.
  useEffect(() => {
    if (phase !== "play") return;
    started.current = performance.now();
    let id = requestAnimationFrame(function frame(now) {
      const t = now - started.current;
      if (t >= WIEZA_MAX_STOP_MS) return drop(WIEZA_MAX_STOP_MS);
      if (moving.current) moving.current.style.left = `${wiezaLeft(view.sides[level], level, tower.width, t) * 100}%`;
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [phase, level]);

  useEffect(() => {
    if (phase !== "over") return;
    const id = setTimeout(() => {
      setPhase("sent");
      onMove({ type: "result", stops });
    }, OVER_MS);
    return () => clearTimeout(id);
  }, [phase]);

  if (!playing || phase === "sent") {
    const rows = (ranking ?? view.players).map((id) => {
      const p = players.find((pl) => pl.id === id);
      const r = view.results[id];
      return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: r ? `${levelsLabel(r.height)} (${percent(r.width)})` : null };
    });
    return (
      <>
        <Scores rows={rows} />
        <p className="text-sm text-fg-muted">
          Liczy się wysokość wieży (najwyżej {WIEZA_LEVELS} pięter). Przy remisie wygrywa szerszy ostatni klocek (procent szerokości pola w nawiasie).
        </p>
      </>
    );
  }

  if (phase === "intro") {
    return (
      <Intro
        preview={<Preview color={color} />}
        time={`Do ${WIEZA_LEVELS} pięter, klocek jedzie coraz szybciej`}
        task="Dotknij, gdy klocek jest nad poprzednim. To, co wystaje, zostaje ucięte"
        score="Liczy się wysokość wieży, pudło kończy partię"
        onStart={() => setPhase("play")}
      />
    );
  }

  const block = (row: number, left: number, width: number) => ({ bottom: `${row * ROW}%`, left: `${left * 100}%`, width: `${width * 100}%`, height: `${ROW}%` });
  // Jadący klocek stoi najwyżej na przedostatnim widocznym piętrze.
  const shift = Math.max(0, tower.height + 1 - (VISIBLE - 2));

  return (
    <section className="flex flex-col gap-2">
      <Stats
        items={[
          { label: "Wysokość", value: `${tower.height}/${WIEZA_LEVELS}` },
          { label: "Szerokość", value: percent(tower.width) },
          { label: "Seria", value: streak },
        ]}
      />
      <div
        className="tile relative mx-auto aspect-square w-full max-w-[calc(100dvh-22rem)] touch-none select-none overflow-hidden"
        onPointerDown={() => phase === "play" && drop(Math.min(WIEZA_MAX_STOP_MS, Math.round(performance.now() - started.current)))}
      >
        <div className="absolute inset-0 transition-transform duration-[180ms]" style={{ transform: `translateY(${shift * ROW}%)` }} aria-hidden>
          <span className="absolute bg-fg-muted" style={block(0, WIEZA_BASE.left, WIEZA_BASE.width)} />
          {cut && <span key={`cut${level}`} className="absolute animate-[piece-fall_0.5s_ease-in_forwards] bg-warning" style={block(level, cut.left, cut.width)} />}
          {tower.blocks.map((b, i) => (
            <span
              key={i}
              className={`absolute ${i % 2 ? "opacity-80" : ""} ${perfect && i === tower.height - 1 ? "animate-[tile-hit_0.35s_ease-out]" : ""}`}
              style={{ ...block(i + 1, b.left, b.width), backgroundColor: color }}
            />
          ))}
          {phase === "play" && (
            <span
              key={`move${level}`}
              ref={moving}
              className="absolute"
              style={{ ...block(level + 1, wiezaLeft(view.sides[level], level, tower.width, 0), tower.width), backgroundColor: color }}
            />
          )}
        </div>
        {stops.length > 0 && (
          <span
            key={level}
            className={`pointer-events-none absolute inset-x-0 top-[12%] animate-[float-up_1.6s_ease-out_forwards] text-center font-mono text-4xl font-semibold tabular-nums ${
              missed ? "text-warning" : perfect ? "text-success" : ""
            }`}
          >
            {verdict}
          </span>
        )}
      </div>
      <p className="text-center text-sm text-fg-muted">Zatrzymaj klocek nad wieżą. To, co wystaje, zostaje odcięte.</p>
    </section>
  );
}
