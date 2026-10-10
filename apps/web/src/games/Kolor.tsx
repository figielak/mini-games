import { type Hsb, KOLOR_COUNT, KOLOR_SHOW_MS, kolorDistance, kolorHints, kolorHsbToRgb, type KolorView, type LobbyPlayer } from "@mini-games/games";
import { useEffect, useState } from "react";
import { Scores } from "../screens/ui.tsx";

interface Props {
  view: KolorView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: { type: "result"; guesses: Hsb[] }) => void;
}

const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
/** Losowy start suwaków (stałe położenie podpowiadałoby wartości); bez skrajności, żeby tory suwaków były czytelne. */
const randomStart = (): Hsb => ({ h: rand(0, 359), s: rand(20, 80), b: rand(30, 80) });

/** Wzór i podgląd mają ten sam rozmiar: duże pole wydaje się jaśniejsze i bardziej nasycone niż małe. */
const SWATCH = "h-40 rounded-tile border border-line";

const css = (c: Hsb) => `rgb(${kolorHsbToRgb(c).join(" ")})`;
/** Wszędzie jedno miejsce po przecinku: „87,3%”. */
const percent = (value: number) => `${value.toFixed(1).replace(".", ",")}%`;
/** Zgodność jednego koloru (ΔE jest ucięta do 100). */
const match = (target: Hsb, guess: Hsb) => percent(100 - kolorDistance(target, guess));
/** Wynik (suma ΔE w dziesiątych częściach) → średnia zgodność. */
const points = (tenths: number) => percent(100 - tenths / (10 * KOLOR_COUNT));

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

/** Pary cel | odpowiedź ze zgodnością pod spodem. */
function Pairs({ targets, guesses }: { targets: Hsb[]; guesses: Hsb[] }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      <span className="col-span-5 text-xs text-fg-muted">wzór | odpowiedź</span>
      {targets.map((t, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="flex h-14 w-full overflow-hidden rounded-inset border border-line">
            <span className="flex-1" style={{ backgroundColor: css(t) }} />
            <span className="flex-1" style={{ backgroundColor: css(guesses[i]) }} />
          </div>
          <span className="font-mono text-xs text-fg-muted">{match(t, guesses[i])}</span>
        </div>
      ))}
    </div>
  );
}

type Phase = "intro" | "show" | "pick" | "reveal" | "sent";

export function Kolor({ view, me, players, ranking, onMove }: Props) {
  const playing = view.players.includes(me) && !(me in view.results);
  const [phase, setPhase] = useState<Phase>("intro");
  const [guesses, setGuesses] = useState<Hsb[]>([]);
  const [current, setCurrent] = useState<Hsb>(randomStart);
  const index = phase === "reveal" ? guesses.length - 1 : guesses.length;
  const color = players.find((p) => p.id === me)?.color;

  useEffect(() => {
    if (phase !== "show") return;
    const id = setTimeout(() => setPhase("pick"), KOLOR_SHOW_MS);
    return () => clearTimeout(id);
  }, [phase, index]);

  function confirm() {
    const all = [...guesses, current];
    setGuesses(all);
    // Po ostatnim kolorze od razu wyniki: pary wszystkich kolorów są na ekranie końcowym.
    if (all.length < KOLOR_COUNT) return setPhase("reveal");
    setPhase("sent");
    onMove({ type: "result", guesses: all });
  }

  function next() {
    setCurrent(randomStart());
    setPhase("show");
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
        <p className="text-sm text-fg-muted">Średnia zgodność z wzorami, więcej znaczy lepiej.</p>
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
          Zobaczysz {KOLOR_COUNT} kolorów, każdy przez 2 sekundy. Po każdym odtwórz go suwakami barwy, nasycenia i jasności. Liczy się średnia
          zgodność z oryginałami: więcej znaczy lepiej.
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
        <div className={SWATCH} style={{ backgroundColor: css(view.targets[index]) }} />
      </section>
    );
  }

  if (phase === "reveal") {
    const target = view.targets[index];
    const wrong = kolorHints(target, guesses[index]);
    return (
      <section className="flex flex-1 flex-col gap-4">
        {counter}
        <div>
          <div className={`${SWATCH} flex overflow-hidden`}>
            <span className="flex-1" style={{ backgroundColor: css(target) }} />
            <span className="flex-1" style={{ backgroundColor: css(guesses[index]) }} />
          </div>
          <div className="mt-1 flex text-center text-sm text-fg-muted">
            <span className="flex-1">Wzór</span>
            <span className="flex-1">Twój kolor</span>
          </div>
        </div>
        <p className="text-center font-mono text-5xl font-semibold tabular-nums">{match(target, guesses[index])}</p>
        <p className="text-center text-fg-muted">{wrong.length ? `Twój kolor: ${wrong.join(", ")}` : "Bardzo blisko"}</p>
        <button type="button" className="btn mt-auto w-full text-bg" style={{ backgroundColor: color }} onClick={next}>
          Następny kolor
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-4">
      {counter}
      <div className={SWATCH} style={{ backgroundColor: css(current) }} />
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
      <button type="button" className="btn mt-auto w-full text-bg" style={{ backgroundColor: color }} onClick={confirm}>
        Zatwierdź kolor
      </button>
    </section>
  );
}
