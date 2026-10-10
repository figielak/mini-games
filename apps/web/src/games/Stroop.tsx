import { type LobbyPlayer, type QuizMove, STROOP_COLORS, type StroopView } from "@mini-games/games";
import { Quiz } from "./Quiz.tsx";

/** Odcienie w kolejności STROOP_COLORS (jak pola Simona). */
const HUES = ["#ff2445", "#3b82f6", "#facc15", "#22c55e"];

interface Props {
  view: StroopView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  winner?: string;
  onMove: (move: QuizMove) => void;
  onRound?: (on: boolean) => void;
}

export function Stroop({ view, ...props }: Props) {
  return (
    <Quiz
      {...props}
      view={view}
      intro="Na ekranie pojawi się nazwa koloru napisana innym kolorem. Wybierz kolor liter, nie znaczenie słowa. Masz 30 sekund, pomyłka blokuje na sekundę."
      question={(i) => {
        const { word, ink } = view.trials[i % view.trials.length];
        return {
          prompt: (
            <span className="text-[min(12vw,3.5rem)] font-bold tracking-wide" style={{ color: HUES[ink] }}>
              {STROOP_COLORS[word]}
            </span>
          ),
          options: STROOP_COLORS.map((name) => <span className="text-base">{name.toLowerCase()}</span>),
          correct: ink,
        };
      }}
    />
  );
}
