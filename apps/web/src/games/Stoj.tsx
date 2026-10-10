import { type LobbyPlayer, STOJ_DURATION_MS, STOJ_SCHEDULE, STOJ_VISIBLE, stojScore, type StojView } from "@mini-games/games";
import { HandPalm } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Intro, Stats } from "../screens/ui.tsx";
import { Results } from "./Quiz.tsx";

type Move = { type: "result"; taps: (number | null)[] };

interface Props {
  view: StojView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  winner?: string;
  onMove: (move: Move) => void;
}

type Phase = "intro" | "play" | "sent";

/** Reakcja szybsza niż 100 ms to zgadywanie: dotknięcie przepada (serwer i tak by je odrzucił). */
const MIN_REACTION = 100;

/** Podgląd na ekranie instrukcji: pole na zmianę zielone i czerwone. */
function Preview() {
  return (
    <>
      <span className="absolute inset-0 flex items-center justify-center bg-success font-semibold text-bg">Dotknij</span>
      <span className="absolute inset-0 flex animate-[preview-half_2.4s_linear_infinite] items-center justify-center gap-2 bg-accent font-semibold text-accent-fg opacity-0 [animation-delay:-1.2s]">
        <HandPalm size={20} weight="fill" />
        Stój!
      </span>
    </>
  );
}

export function Stoj({ view, me, players, ranking, winner, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  /** Bieżący bodziec: czy jeszcze świeci i czy gracz go już dotknął. */
  const [shown, setShown] = useState<{ i: number; lit: boolean; tapped: boolean } | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const run = useRef({ start: 0, shownAt: 0, taps: [] as (number | null)[], timer: 0 });

  // Terminy liczone od startu partii, nie od poprzedniego timera: spóźniony setTimeout nie przesuwa kolejnych bodźców.
  const after = (ms: number, fn: () => void) => {
    run.current.timer = window.setTimeout(fn, run.current.start + ms - performance.now());
  };

  function show(i: number) {
    if (i >= STOJ_SCHEDULE.length) return setShown(null);
    const { at, window: span } = STOJ_SCHEDULE[i];
    run.current.shownAt = performance.now();
    setShown({ i, lit: true, tapped: false });
    after(at + span * STOJ_VISIBLE, () => {
      setShown((s) => s && { ...s, lit: false });
      after(at + span, () => show(i + 1));
    });
  }

  function start() {
    run.current = { start: performance.now(), shownAt: 0, taps: STOJ_SCHEDULE.map(() => null), timer: 0 };
    setNow(run.current.start);
    setPhase("play");
    show(0);
  }

  function tap() {
    if (!shown || shown.tapped) return;
    const r = run.current;
    const reaction = Math.round(performance.now() - r.shownAt);
    if (reaction < MIN_REACTION) return;
    // Spóźniony timer następnego bodźca mógłby wydłużyć okno ponad to, co przyjmie serwer.
    r.taps[shown.i] = Math.min(reaction, STOJ_SCHEDULE[shown.i].window);
    setShown({ ...shown, tapped: true });
    if (view.reds[shown.i]) navigator.vibrate?.(60);
    else setLast(reaction);
  }

  // Zegar gry: odświeża licznik i kończy partię po 30 s.
  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => {
      const r = run.current;
      setNow(performance.now());
      if (performance.now() - r.start < STOJ_DURATION_MS) return;
      clearTimeout(r.timer);
      setPhase("sent");
      onMove({ type: "result", taps: r.taps });
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => () => clearTimeout(run.current.timer), []);

  if (!playing || phase === "sent") {
    return (
      <Results
        view={view}
        me={me}
        players={players}
        ranking={ranking}
        winner={winner}
        points={stojScore}
        note="Punkty to trafienia minus 2 za każdy błąd. Przy remisie wygrywa niższy średni czas."
      />
    );
  }

  if (phase === "intro") {
    return (
      <Intro
        preview={<Preview />}
        time={`${STOJ_DURATION_MS / 1000} sekund, tempo rośnie`}
        task="Dotykaj zielonych pól, czerwonych nie wolno"
        score="Trafienie to punkt, dotknięcie czerwonego zabiera 2"
        onStart={start}
      />
    );
  }

  const { taps } = run.current;
  const errors = taps.filter((t, i) => t !== null && view.reds[i]).length;
  const times = taps.filter((t, i): t is number => t !== null && !view.reds[i]);
  const left = Math.max(0, Math.ceil((STOJ_DURATION_MS - (now - run.current.start)) / 1000));
  const red = shown !== null && view.reds[shown.i];
  const missed = red && shown.tapped;
  const lit = shown?.lit && !shown.tapped;
  return (
    <div className="flex flex-1 flex-col gap-3">
      <Stats
        items={[
          { label: "Punkty", value: stojScore({ times, errors }) },
          { label: "Błędy", value: errors, warn: errors > 0 },
          { label: "Do końca", value: `${left} s` },
        ]}
      />
      <button
        // Klucz z błędu: przycisk montuje się od nowa i animacja startuje jeszcze raz.
        key={missed ? `miss-${shown.i}` : "field"}
        type="button"
        onPointerDown={tap}
        className={`flex min-h-80 flex-1 touch-none select-none items-center justify-center gap-3 rounded-tile border border-line text-2xl font-semibold ${
          missed
            ? "animate-[tile-miss_0.35s_ease-out] bg-surface text-warning"
            : !lit
              ? "bg-surface text-fg-muted"
              : red
                ? "bg-accent text-accent-fg"
                : "bg-success text-bg"
        }`}
      >
        {missed ? (
          "−2"
        ) : !lit ? (
          last !== null && <span className="font-mono tabular-nums">{last} ms</span>
        ) : red ? (
          <>
            <HandPalm size={32} weight="fill" aria-hidden />
            Stój!
          </>
        ) : (
          "Dotknij"
        )}
      </button>
    </div>
  );
}
