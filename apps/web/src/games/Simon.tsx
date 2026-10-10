import { Circle, type Icon, Square, Star, Triangle } from "@phosphor-icons/react";
import type { LobbyPlayer, SimonView } from "@mini-games/games";
import { useEffect, useRef, useState } from "react";
import { Scores } from "../screens/ui.tsx";

interface Props {
  view: SimonView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; score: number }) => void;
}

/** Kolor i kształt, żeby dało się grać bez rozróżniania kolorów. */
const PADS: { color: string; icon: Icon }[] = [
  { color: "#ff2445", icon: Circle },
  { color: "#3b82f6", icon: Square },
  { color: "#facc15", icon: Triangle },
  { color: "#22c55e", icon: Star },
];
const LIT_MS = 450;
const GAP_MS = 150;

type Phase = "intro" | "show" | "input" | "sent";

export function Simon({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [length, setLength] = useState(1);
  const [lit, setLit] = useState<number | null>(null);
  const step = useRef(0);
  const timers = useRef<number[]>([]);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Odtwarza n pierwszych kroków, potem oddaje głos graczowi. */
  function show(n: number) {
    setLength(n);
    setPhase("show");
    step.current = 0;
    for (let i = 0; i < n; i++) {
      later(600 + i * (LIT_MS + GAP_MS), () => setLit(view.sequence[i]));
      later(600 + i * (LIT_MS + GAP_MS) + LIT_MS, () => setLit(null));
    }
    later(600 + n * (LIT_MS + GAP_MS), () => setPhase("input"));
  }

  function finish(score: number) {
    setPhase("sent");
    onMove({ type: "result", score });
  }

  function press(pad: number) {
    if (phase !== "input") return;
    setLit(pad);
    later(200, () => setLit(null));
    if (pad !== view.sequence[step.current]) return finish(length - 1);
    if (++step.current < length) return;
    if (length === view.sequence.length) return finish(length);
    setPhase("show");
    later(400, () => show(length + 1));
  }

  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: id in view.results ? String(view.results[id]) : null };
  });

  if (!playing || phase === "sent") return <Scores rows={rows} />;

  if (phase === "intro") {
    return (
      <section className="tile flex flex-col gap-4 p-4">
        <p>Zapamiętaj sekwencję i powtórz ją. Co rundę dochodzi jeden krok, pierwsza pomyłka kończy grę.</p>
        <button type="button" className="btn btn-primary w-full" onClick={() => show(1)}>
          Start
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between font-mono text-sm text-fg-muted">
        <span>Seria: {length - 1}</span>
        <span>{phase === "show" ? "Patrz" : "Powtórz"}</span>
      </div>
      <div className="grid aspect-square grid-cols-2 gap-3">
        {PADS.map(({ color, icon: PadIcon }, i) => (
          <button
            key={color}
            type="button"
            aria-label={`Pole ${i + 1}`}
            disabled={phase !== "input"}
            onPointerDown={() => press(i)}
            className="flex touch-none select-none items-center justify-center rounded-tile transition-colors duration-100"
            style={{
              backgroundColor: lit === i ? color : `color-mix(in srgb, ${color} 22%, var(--color-bg))`,
              color: lit === i ? "var(--color-accent-fg)" : color,
            }}
          >
            <PadIcon size={48} weight="fill" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
