import { KAT_MAX_ANSWER, KAT_SHOW_MS, type KatRound, type KatView, type LobbyPlayer } from "@mini-games/games";
import { Szacowanie } from "./Szacowanie.tsx";

interface Props {
  view: KatView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; answers: number[] } | { type: "progress"; done: number }) => void;
}

/** Długość ramienia i promień łuku w jednostkach pola 100×100. */
const ARM = 40;
const ARC = 12;

/** Punkt w odległości `r` od środka pola, pod kątem `deg` (oś y w dół, więc kąt rośnie zgodnie z zegarem). */
function at(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
}

/** Kąt z wierzchołkiem na środku; `arc` dorysowuje łuk przy wierzchołku (odsłona po odpowiedzi). */
function Angle({ angle, rotation, arc, className = "" }: KatRound & { arc?: boolean; className?: string }) {
  const a = at(rotation, ARM);
  const b = at(rotation + angle, ARM);
  const from = at(rotation, ARC);
  const to = at(rotation + angle, ARC);
  return (
    <svg viewBox="0 0 100 100" className={`absolute inset-0 size-full ${className}`} fill="none" strokeLinecap="round" aria-hidden>
      {arc && <path d={`M ${from.x} ${from.y} A ${ARC} ${ARC} 0 0 1 ${to.x} ${to.y}`} className="stroke-fg-muted" strokeWidth={1} />}
      <path d={`M ${a.x} ${a.y} L 50 50 L ${b.x} ${b.y}`} className="stroke-fg" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/** Podgląd na ekranie instrukcji: kąt miga, potem pytanie o miarę. */
function Preview() {
  return (
    <>
      <Angle angle={65} rotation={-80} className="animate-[preview-half_3s_linear_infinite]" />
      <span className="animate-[preview-half_3s_linear_infinite] font-mono text-3xl font-semibold opacity-0 [animation-delay:-1.5s]">Ile°?</span>
    </>
  );
}

export function Kat({ view, ...props }: Props) {
  return (
    <Szacowanie
      {...props}
      view={view}
      truths={view.rounds.map((r) => r.angle)}
      showMs={KAT_SHOW_MS}
      maxAnswer={KAT_MAX_ANSWER}
      unit="°"
      question="Ile stopni miał kąt?"
      preview={<Preview />}
      time={`${view.rounds.length} rund, kąt widać przez ${String(KAT_SHOW_MS / 1000).replace(".", ",")} s`}
      task="Wpisz jego miarę w stopniach"
      score="Liczy się suma pomyłek (było 70°, wpisujesz 62°: 8 punktów), mniej znaczy lepiej"
      draw={(index, reveal) => <Angle {...view.rounds[index]} arc={reveal} />}
    />
  );
}
