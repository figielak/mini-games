import { type Hsb, KOLOR_COUNT, KOLOR_SHOW_MS, kolorDistance, kolorHsbToRgb, type KolorView, type LobbyPlayer } from "@mini-games/games";
import { useEffect, useState } from "react";
import { Scores } from "../screens/ui.tsx";

interface Props {
  view: KolorView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; guesses: Hsb[] }) => void;
}

const START: Hsb = { h: 0, s: 50, b: 50 };

const css = (c: Hsb) => `rgb(${kolorHsbToRgb(c).join(" ")})`;
/** Wynik w dziesiątych częściach → „87,3”. */
const points = (tenths: number) => (tenths / 10).toFixed(1).replace(".", ",");

const SLIDERS: { key: keyof Hsb; label: string; max: number; track: (c: Hsb) => string }[] = [
  {
    key: "h",
    label: "Barwa",
    max: 359,
    track: (c) => `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => css({ ...c, h: h % 360 })).join(", ")})`,
  },
  { key: "s", label: "Nasycenie", max: 100, track: (c) => `linear-gradient(to right, ${css({ ...c, s: 0 })}, ${css({ ...c, s: 100 })})` },
  { key: "b", label: "Jasność", max: 100, track: (c) => `linear-gradient(to right, ${css({ ...c, b: 0 })}, ${css({ ...c, b: 100 })})` },
];

/** Pary cel | odpowiedź z odległością pod spodem. */
function Pairs({ targets, guesses }: { targets: Hsb[]; guesses: Hsb[] }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {targets.map((t, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="flex h-14 w-full overflow-hidden rounded-[10px] border border-line">
            <span className="flex-1" style={{ backgroundColor: css(t) }} />
            <span className="flex-1" style={{ backgroundColor: css(guesses[i]) }} />
          </div>
          <span className="font-mono text-xs text-fg-muted">{Math.round(kolorDistance(t, guesses[i]))}</span>
        </div>
      ))}
    </div>
  );
}

type Phase = "intro" | "show" | "pick" | "sent";

export function Kolor({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [guesses, setGuesses] = useState<Hsb[]>([]);
  const [current, setCurrent] = useState<Hsb>(START);
  const index = guesses.length;

  useEffect(() => {
    if (phase !== "show") return;
    const id = setTimeout(() => setPhase("pick"), KOLOR_SHOW_MS);
    return () => clearTimeout(id);
  }, [phase, index]);

  function next() {
    const all = [...guesses, current];
    setGuesses(all);
    setCurrent(START);
    if (all.length < KOLOR_COUNT) return setPhase("show");
    setPhase("sent");
    onMove({ type: "result", guesses: all });
  }

  const over = ranking !== undefined;
  const rows = (ranking ?? view.players).map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { id, nick: p?.nick ?? "Gracz", color: p?.color, me: id === me, score: id in view.results ? points(view.results[id]) : null };
  });

  if (!playing || phase === "sent") {
    // Na koniec pary wszystkich; w trakcie tylko własne (cudze odpowiedzi podpowiadałyby kolory).
    const shown = (over ? (ranking ?? []) : [me]).filter((id) => view.guesses[id]);
    return (
      <>
        <Scores rows={rows} />
        {shown.map((id) => (
          <section key={id} className="tile flex flex-col gap-2 p-3">
            <span className="text-sm">
              {rows.find((r) => r.id === id)?.nick}
              {id === me && <span className="text-fg-muted"> (ty)</span>}
            </span>
            {view.guesses[id].length ? <Pairs targets={view.targets} guesses={view.guesses[id]} /> : <span className="text-sm text-fg-muted">Bez odpowiedzi</span>}
          </section>
        ))}
      </>
    );
  }

  if (phase === "intro") {
    return (
      <section className="tile flex flex-col gap-4 p-4">
        <p>
          Zobaczysz {KOLOR_COUNT} kolorów, każdy przez 2 sekundy. Po każdym odtwórz go suwakami barwy, nasycenia i jasności. Liczy się suma
          odległości od oryginałów: mniej znaczy lepiej.
        </p>
        <button type="button" className="btn btn-primary w-full" onClick={() => setPhase("show")}>
          Start
        </button>
      </section>
    );
  }

  const counter = (
    <span className="label">
      Kolor {index + 1}/{KOLOR_COUNT}
    </span>
  );

  if (phase === "show") {
    return (
      <section className="flex flex-1 flex-col gap-2">
        {counter}
        <div className="min-h-80 flex-1 rounded-[20px] border border-line" style={{ backgroundColor: css(view.targets[index]) }} />
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-4">
      {counter}
      <div className="h-40 rounded-[20px] border border-line" style={{ backgroundColor: css(current) }} />
      {SLIDERS.map(({ key, label, max, track }) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="text-sm text-fg-muted">{label}</span>
          <input
            type="range"
            min={0}
            max={max}
            value={current[key]}
            onChange={(e) => setCurrent({ ...current, [key]: Number(e.target.value) })}
            className="swatch-range"
            style={{ background: track(current) }}
          />
        </label>
      ))}
      <button type="button" className="btn btn-primary mt-auto w-full" onClick={next}>
        {index + 1 < KOLOR_COUNT ? "Dalej" : "Zakończ"}
      </button>
    </section>
  );
}
