import { type LobbyPlayer, type QuizMove, STROOP_COLORS, type StroopView } from "@mini-games/games";
import { Quiz } from "./Quiz.tsx";

/** Odcienie w kolejności STROOP_COLORS (jak pola Simona). */
const HUES = ["#ff2445", "#3b82f6", "#facc15", "#22c55e"];

interface Props {
  view: StroopView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: QuizMove) => void;
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
            <span className="text-4xl font-bold tracking-wide" style={{ color: HUES[ink] }}>
              {STROOP_COLORS[word]}
            </span>
          ),
          options: STROOP_COLORS.map((name, c) => (
            <>
              <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: HUES[c] }} aria-hidden />
              <span className="text-base">{name.toLowerCase()}</span>
            </>
          )),
          correct: ink,
        };
      }}
    />
  );
}
