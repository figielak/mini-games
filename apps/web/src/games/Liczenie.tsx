import type { LiczenieView, LobbyPlayer, QuizMove } from "@mini-games/games";
import { Quiz } from "./Quiz.tsx";

interface Props {
  view: LiczenieView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: QuizMove) => void;
}

export function Liczenie({ view, ...props }: Props) {
  return (
    <Quiz
      {...props}
      view={view}
      intro="Licz w pamięci i wybierz dobry wynik. Masz 30 sekund, pomyłka blokuje na sekundę."
      question={(i) => {
        const p = view.problems[i % view.problems.length];
        return {
          prompt: <span className="font-mono text-4xl font-semibold">{p.text}</span>,
          options: p.options.map((o) => <span className="font-mono">{o}</span>),
          correct: p.answer,
        };
      }}
    />
  );
}
