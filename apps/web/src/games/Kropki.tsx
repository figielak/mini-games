import { KROPKI_ROUNDS, KROPKI_SHOW_MS, type KropkiView, type LobbyPlayer } from "@mini-games/games";
import { Szacowanie } from "./Szacowanie.tsx";

interface Props {
  view: KropkiView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; answers: number[] } | { type: "progress"; done: number }) => void;
}

/** Podgląd na ekranie instrukcji: kropki migają, potem pytanie o liczbę. */
const PREVIEW_DOTS = [
  [12, 30], [22, 68], [30, 22], [38, 52], [44, 80], [52, 30], [58, 62], [66, 18], [72, 46], [78, 76], [86, 28], [90, 58],
];

function Preview() {
  return (
    <>
      {PREVIEW_DOTS.map(([x, y]) => (
        <span key={x} className="absolute size-2.5 animate-[preview-half_3s_linear_infinite] rounded-full bg-fg" style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
      <span className="animate-[preview-half_3s_linear_infinite] font-mono text-3xl font-semibold opacity-0 [animation-delay:-1.5s]">Ile?</span>
    </>
  );
}

export function Kropki({ view, ...props }: Props) {
  return (
    <Szacowanie
      {...props}
      view={view}
      truths={view.rounds.map((r) => r.length)}
      showMs={KROPKI_SHOW_MS}
      maxAnswer={99}
      question="Ile było kropek?"
      preview={<Preview />}
      time={`${KROPKI_ROUNDS} rund, kropki widać przez ${String(KROPKI_SHOW_MS / 1000).replace(".", ",")} s`}
      task="Wpisz, ile ich było"
      score="Liczy się suma pomyłek (było 42, wpisujesz 38: 4 punkty), mniej znaczy lepiej"
      draw={(index) =>
        view.rounds[index].map((d, i) => (
          <span
            key={i}
            className="absolute size-[5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"
            style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
          />
        ))
      }
    />
  );
}
