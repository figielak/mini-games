import { type LobbyPlayer, type ObrotCells, obrotScore, type ObrotView, type QuizMove } from "@mini-games/games";
import { ArrowsClockwise, FlipHorizontal } from "@phosphor-icons/react";
import { Quiz, QuizPreview } from "./Quiz.tsx";

interface Props {
  view: ObrotView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  winner?: string;
  onMove: (move: QuizMove) => void;
  onRound?: (msLeft: number | null) => void;
}

/**
 * Figura z klocków na środku kwadratu o boku `cells.length − 1` (dłuższa chiralna figura nie istnieje):
 * obie figury pary mają wtedy tę samą skalę i rozmiar klocka niczego nie zdradza.
 */
function Figure({ cells, className }: { cells: ObrotCells; className: string }) {
  const side = cells.length - 1;
  const dx = (side - 1 - Math.max(...cells.map(([x]) => x))) / 2;
  const dy = (side - 1 - Math.max(...cells.map(([, y]) => y))) / 2;
  return (
    <svg viewBox={`0 0 ${side} ${side}`} className={className} fill="currentColor" aria-hidden>
      {cells.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x + dx + 0.04} y={y + dy + 0.04} width={0.92} height={0.92} rx={0.12} />
      ))}
    </svg>
  );
}

const SAMPLE: ObrotCells[] = [
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [0, 1], [1, 0], [2, 0]],
];

export function Obrot({ view, ...props }: Props) {
  return (
    <Quiz
      {...props}
      view={view}
      points={obrotScore}
      note="Punkty to trafienia minus błędy. Przy remisie wygrywa niższy średni czas."
      score="Trafienie to punkt, pomyłka zabiera punkt i blokuje na sekundę"
      task="Dwie figury z klocków: ta sama obrócona czy lustrzane odbicie?"
      preview={
        <QuizPreview
          prompt={
            <div className="flex gap-4">
              {SAMPLE.map((cells, i) => (
                <Figure key={i} cells={cells} className="size-12" />
              ))}
            </div>
          }
          options={["ta sama", "lustro"]}
          correct={0}
        />
      }
      question={(i) => {
        const { a, b, mirror } = view.trials[i % view.trials.length];
        return {
          prompt: (
            <div className="flex w-full items-center justify-around gap-4">
              <Figure cells={a} className="w-2/5" />
              <Figure cells={b} className="w-2/5" />
            </div>
          ),
          options: [
            <>
              <ArrowsClockwise size={24} aria-hidden />
              Ta sama
            </>,
            <>
              <FlipHorizontal size={24} aria-hidden />
              Lustro
            </>,
          ],
          correct: +mirror,
        };
      }}
    />
  );
}
