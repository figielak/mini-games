import type { InnySymbol, InnyView, LobbyPlayer, QuizMove } from "@mini-games/games";
import { Quiz, QuizPreview } from "./Quiz.tsx";

interface Props {
  view: InnyView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  winner?: string;
  onMove: (move: QuizMove) => void;
  onRound?: (msLeft: number | null) => void;
}

/** Wielokąt foremny z wierzchołkiem u góry, obrócony o `angle`. */
function Shape({ sides, angle, hue, light, size, className = "size-4/5" }: InnySymbol & { className?: string }) {
  const points = Array.from({ length: sides }, (_, k) => {
    const a = (2 * Math.PI * k) / sides - Math.PI / 2;
    return `${Math.cos(a).toFixed(3)},${Math.sin(a).toFixed(3)}`;
  }).join(" ");
  return (
    <svg viewBox="-1 -1 2 2" className={className} aria-hidden>
      <polygon points={points} transform={`rotate(${angle}) scale(${size / 100})`} fill={`hsl(${hue} 70% ${light}%)`} />
    </svg>
  );
}

const SAMPLE: InnySymbol = { sides: 3, angle: 0, hue: 210, light: 60, size: 100 };

export function Inny({ view, ...props }: Props) {
  return (
    <Quiz
      {...props}
      view={view}
      retry
      task="Jeden symbol różni się obrotem, odcieniem, rozmiarem albo kształtem: dotknij go. Siatka rośnie po każdym trafieniu"
      preview={
        <QuizPreview
          prompt={null}
          options={[0, 0, 40, 0].map((angle) => (
            <Shape {...SAMPLE} angle={angle} className="block size-8" />
          ))}
          correct={2}
        />
      }
      question={(i) => {
        const { cols, rows, odd, base, other } = view.trials[i % view.trials.length];
        return {
          cols,
          status: "Dotknij symbol, który się różni",
          options: Array.from({ length: cols * rows }, (_, cell) => <Shape {...(cell === odd ? other : base)} />),
          correct: odd,
        };
      }}
    />
  );
}
