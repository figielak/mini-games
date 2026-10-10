import { type LobbyPlayer, type QuizMove, STROOP_COLORS, type StroopView } from "@mini-games/games";
import { Quiz, QuizPreview } from "./Quiz.tsx";

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
      task="Nazwa koloru jest napisana innym kolorem: wybierz kolor liter, nie znaczenie słowa"
      preview={
        <QuizPreview
          prompt={
            <span className="text-3xl font-bold tracking-wide" style={{ color: HUES[1] }}>
              {STROOP_COLORS[3]}
            </span>
          }
          options={STROOP_COLORS.map((name) => name.toLowerCase())}
          correct={1}
        />
      }
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
