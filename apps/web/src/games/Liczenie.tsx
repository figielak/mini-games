import type { LiczenieView, LobbyPlayer, QuizMove } from "@mini-games/games";
import { Quiz, QuizPreview } from "./Quiz.tsx";

interface Props {
  view: LiczenieView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  winner?: string;
  onMove: (move: QuizMove) => void;
  onRound?: (msLeft: number | null) => void;
}

export function Liczenie({ view, ...props }: Props) {
  return (
    <Quiz
      {...props}
      view={view}
      task="Licz w pamięci i wybierz dobry wynik"
      preview={<QuizPreview prompt={<span className="font-mono text-3xl font-semibold">7 × 6</span>} options={[36, 42, 48, 54].map((n) => <span className="font-mono">{n}</span>)} correct={1} />}
      question={(i) => {
        const p = view.problems[i % view.problems.length];
        return {
          prompt: <span className="font-mono text-5xl font-semibold">{p.text}</span>,
          options: p.options.map((o) => <span className="font-mono">{o}</span>),
          correct: p.answer,
        };
      }}
    />
  );
}
