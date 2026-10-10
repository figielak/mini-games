import { type LobbyPlayer, RYTM_BEATS, RYTM_MAX_TAPS, RYTM_TAP_MS, type RytmView } from "@mini-games/games";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { Intro, Scores } from "../screens/ui.tsx";

interface Props {
  view: RytmView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; taps: number[] }) => void;
}

type Phase = "intro" | "listen" | "tap" | "sent";

/** Cisza po „Start”, zanim metronom zagra pierwsze uderzenie. */
const LEAD_MS = 1000;
/** Tyle świeci pole po uderzeniu metronomu i po stuknięciu. */
const FLASH_MS = 100;
/** Uderzenia w takcie: pierwsze jest akcentowane. */
const BAR = 4;

const bpm = (interval: number) => Math.round(60_000 / interval);

/** Podgląd na ekranie instrukcji: kropka miga jak metronom. */
function Preview() {
  return <span className="size-12 animate-[preview-half_1s_linear_infinite] rounded-full bg-fg" />;
}

export function Rytm({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const color = players.find((p) => p.id === me)?.color;
  const [phase, setPhase] = useState<Phase>("intro");
  /** Numer ostatniego zagranego uderzenia metronomu, -1 przed pierwszym. */
  const [beat, setBeat] = useState(-1);
  const [lit, setLit] = useState(false);
  const [pressed, setPressed] = useState(false);
  const run = useRef({ last: 0, taps: [] as number[], timers: [] as number[], press: 0, audio: null as AudioContext | null });

  function start() {
    const r = run.current;
    const begin = performance.now();
    const at = (i: number) => LEAD_MS + i * view.interval;
    r.last = begin + at(RYTM_BEATS - 1);
    // Terminy liczone od startu, nie od poprzedniego timera: spóźniony setTimeout nie przesuwa kolejnych uderzeń.
    const after = (ms: number, fn: () => void) => r.timers.push(window.setTimeout(fn, begin + ms - performance.now()));

    // ponytail: opóźnienie wyjścia audio (głośnik Bluetooth) przesuwa tylko pierwszy odstęp, kalibracji nie ma.
    // Bez gestu (start sam po czasie instrukcji) przeglądarka nie zagra: zostaje błysk i wibracja.
    try {
      const audio = (r.audio = new AudioContext());
      for (let i = 0; i < RYTM_BEATS; i++) {
        const when = audio.currentTime + at(i) / 1000;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = i % BAR ? 880 : 1320;
        gain.gain.setValueAtTime(0.3, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + 0.03);
        osc.connect(gain).connect(audio.destination);
        osc.start(when);
        osc.stop(when + 0.04);
      }
    } catch {
      // Brak WebAudio: gra działa z samym błyskiem.
    }

    for (let i = 0; i < RYTM_BEATS; i++) {
      after(at(i), () => {
        setBeat(i);
        setLit(true);
        navigator.vibrate?.(30);
        if (i === RYTM_BEATS - 1) setPhase("tap");
      });
      after(at(i) + FLASH_MS, () => setLit(false));
    }
    after(at(RYTM_BEATS - 1) + RYTM_TAP_MS, () => {
      setPhase("sent");
      onMove({ type: "result", taps: r.taps });
    });
    setPhase("listen");
  }

  function tap(e: PointerEvent) {
    const r = run.current;
    // Czas zdarzenia, nie obsługi: zajęty wątek nie dolicza opóźnienia.
    const t = Math.round(e.timeStamp - r.last);
    if (t <= (r.taps.at(-1) ?? 0) || t > RYTM_TAP_MS || r.taps.length >= RYTM_MAX_TAPS) return;
    r.taps.push(t);
    setPressed(true);
    clearTimeout(r.press);
    r.press = window.setTimeout(() => setPressed(false), FLASH_MS);
  }

  useEffect(
    () => () => {
      const r = run.current;
      r.timers.forEach(clearTimeout);
      clearTimeout(r.press);
      void r.audio?.close();
    },
    [],
  );

  if (!playing || phase === "sent") {
    const { taps } = run.current;
    const rows = (ranking ?? view.players).map((id) => {
      const p = players.find((pl) => pl.id === id);
      return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: id in view.results ? `${view.results[id]} ms` : null };
    });
    return (
      <>
        {taps.length > 0 && (
          <section className="tile flex flex-col items-center gap-1 p-6">
            <span className="label">Twoje tempo</span>
            {/* Średni odstęp to czas ostatniego stuknięcia podzielony przez ich liczbę. */}
            <span className="text-7xl font-semibold tabular-nums">{bpm(taps[taps.length - 1] / taps.length)}</span>
            <span className="text-2xl font-semibold tabular-nums text-fg-muted">cel {bpm(view.interval)} BPM</span>
          </section>
        )}
        <Scores rows={rows} />
      </>
    );
  }

  if (phase === "intro") {
    return (
      <Intro
        preview={<Preview />}
        time={`${RYTM_BEATS} uderzeń metronomu, potem cisza`}
        task={`Stukaj dalej w tym samym tempie przez ${RYTM_TAP_MS / 1000} sekund`}
        score="Liczy się średnia odchyłka odstępów, mniej znaczy lepiej"
        onStart={start}
      />
    );
  }

  const tapping = phase === "tap";
  const accent = beat % BAR === 0;
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="tile flex flex-col gap-3 p-4" aria-hidden>
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: RYTM_BEATS }, (_, i) => (
            <span key={i} className={`rounded-full ${i % BAR ? "size-2.5" : "size-3.5"} ${i <= beat ? "bg-fg" : "bg-line"}`} />
          ))}
        </div>
        {/* Płynny pasek zamiast licznika sekund: tykające cyfry podawałyby tempo 60 BPM. */}
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-fg-muted transition-[width] ease-linear" style={{ width: tapping ? "100%" : "0%", transitionDuration: `${RYTM_TAP_MS}ms` }} />
        </div>
      </div>
      <button
        type="button"
        // W trakcie metronomu stuknięcia się nie liczą.
        onPointerDown={tapping ? tap : undefined}
        className={`flex min-h-80 flex-1 touch-none select-none items-center justify-center rounded-tile border border-line text-2xl font-semibold ${
          pressed ? "text-bg" : lit ? (accent ? "bg-fg text-bg" : "bg-fg-muted text-bg") : "bg-surface text-fg-muted"
        }`}
        style={{ backgroundColor: pressed ? color : undefined }}
      >
        {tapping && !lit ? "Stukaj dalej" : beat < 0 ? "Słuchaj" : <span className="text-7xl tabular-nums">{(beat % BAR) + 1}</span>}
      </button>
    </div>
  );
}
