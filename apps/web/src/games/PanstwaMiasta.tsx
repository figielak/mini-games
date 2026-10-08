import { HandPalm } from "@phosphor-icons/react";
import { type LobbyPlayer, type PanstwaMiastaMove, type PanstwaMiastaView, PM_ANSWER_MAX, PM_CATEGORIES, pmFits, pmNormalize } from "@mini-games/games";
import { useEffect, useRef, useState } from "react";
import { Scores } from "../screens/ui.tsx";

interface Props {
  view: PanstwaMiastaView;
  me: string;
  players: LobbyPlayer[];
  ranking?: string[];
  onMove: (move: PanstwaMiastaMove) => void;
}

const DRAFT_MS = 500;

export function PanstwaMiasta({ view, me, players, ranking, onMove }: Props) {
  const player = (id: string) => players.find((p) => p.id === id);
  const letter = view.letters[view.round];
  const playing = view.players.includes(me);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-fg-muted">
          Runda {view.round + 1}/{view.letters.length}
        </span>
        <span className="text-5xl font-semibold" aria-label={`Litera ${letter}`}>
          {letter}
        </span>
      </div>

      {view.phase === "write" &&
        (playing && !view.done.includes(me) ? (
          <Writing key={view.round} view={view} me={me} stopBy={view.stop && player(view.stop)?.nick} onMove={onMove} />
        ) : (
          <p className="tile p-4 text-fg-muted">
            {view.stop && <StopBanner nick={player(view.stop)?.nick} />}
            {playing ? "Czekamy, aż reszta skończy pisać." : "Gracze piszą."}
          </p>
        ))}

      {view.phase === "vote" &&
        (playing && !(me in view.votes) ? (
          <Voting key={view.round} view={view} me={me} player={player} onMove={onMove} />
        ) : (
          <>
            <p className="tile p-4 text-fg-muted">Czekamy na głosy reszty.</p>
            <Answers view={view} player={player} />
          </>
        ))}

      {(view.phase === "summary" || view.phase === "over") && (
        <>
          <Answers view={view} player={player} scored />
          <Scores
            rows={(ranking ?? view.players).map((id) => ({
              id,
              nick: player(id)?.nick ?? "Gracz",
              color: player(id)?.color,
              me: id === me,
              score: String(view.totals[id]),
            }))}
          />
          {view.phase === "summary" && playing && (
            <button type="button" className="btn btn-primary w-full" disabled={view.ready.includes(me)} onClick={() => onMove({ type: "next" })}>
              {view.ready.includes(me) ? "Czekamy na resztę" : "Dalej"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function StopBanner({ nick }: { nick?: string }) {
  return (
    <span role="status" className="mb-2 flex items-center gap-2 font-semibold text-warning">
      <HandPalm size={20} weight="fill" aria-hidden />
      STOP! {nick ?? "Ktoś"} ma komplet
    </span>
  );
}

/** Pola odpowiedzi. Szkic idzie na serwer w tle, więc przepada najwyżej pół sekundy pisania. */
function Writing({ view, me, stopBy, onMove }: { view: PanstwaMiastaView; me: string; stopBy?: string | null; onMove: Props["onMove"] }) {
  const [answers, setAnswers] = useState(() => view.answers[me] ?? PM_CATEGORIES.map(() => ""));
  const timer = useRef<number>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function change(i: number, value: string) {
    const next = answers.map((a, j) => (j === i ? value : a));
    setAnswers(next);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onMove({ type: "write", answers: next, done: false }), DRAFT_MS);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    clearTimeout(timer.current);
    onMove({ type: "write", answers, done: true });
  }

  const full = answers.every((a) => a.trim());
  return (
    <form className="tile flex flex-col gap-3 p-4" onSubmit={submit}>
      {stopBy && <StopBanner nick={stopBy} />}
      {PM_CATEGORIES.map((category, i) => (
        <div key={category} className="flex flex-col gap-1">
          <label htmlFor={`pm-${i}`} className="label">
            {category}
          </label>
          <input
            id={`pm-${i}`}
            className="field"
            value={answers[i]}
            maxLength={PM_ANSWER_MAX}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint={i < PM_CATEGORIES.length - 1 ? "next" : "done"}
            aria-invalid={answers[i].trim() !== "" && !pmFits(view.letters[view.round], answers[i])}
            onChange={(e) => change(i, e.target.value)}
          />
        </div>
      ))}
      <button type="submit" className="btn btn-primary w-full">
        {full && !view.stop ? "STOP!" : "Gotowe"}
      </button>
    </form>
  );
}

type PlayerOf = (id: string) => LobbyPlayer | undefined;

function Voting({ view, me, player, onMove }: { view: PanstwaMiastaView; me: string; player: PlayerOf; onMove: Props["onMove"] }) {
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setRejected((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  function submit() {
    onMove({
      type: "vote",
      // id sesji Colyseus nie zawiera dwukropka
      rejected: [...rejected].map((key) => ({ category: Number(key.split(":")[0]), player: key.split(":")[1] })),
    });
  }

  return (
    <>
      <p className="text-sm text-fg-muted">Dotknij cudzej odpowiedzi, która się nie liczy. Odpada, gdy odrzuci ją ponad połowa pozostałych.</p>
      <Answers view={view} player={player} me={me} rejected={rejected} onToggle={toggle} />
      <button type="button" className="btn btn-primary w-full" onClick={submit}>
        {rejected.size ? `Zatwierdź (odrzucam ${rejected.size})` : "Wszystko się zgadza"}
      </button>
    </>
  );
}

/**
 * Odpowiedzi wszystkich, po kategoriach. Z `onToggle`: cudze ważne odpowiedzi da się odrzucić.
 * Ze `scored`: punkty z ostatniej rundy.
 */
function Answers({
  view,
  player,
  me,
  rejected,
  onToggle,
  scored,
}: {
  view: PanstwaMiastaView;
  player: PlayerOf;
  me?: string;
  rejected?: Set<string>;
  onToggle?: (key: string) => void;
  scored?: boolean;
}) {
  const letter = view.letters[view.round];
  return (
    <section className="tile flex flex-col gap-4 p-4">
      {PM_CATEGORIES.map((category, c) => {
        const valid = view.players.filter((p) => pmFits(letter, view.answers[p]?.[c] ?? ""));
        return (
          <div key={category} className="flex flex-col gap-1">
            <h3 className="label">{category}</h3>
            {view.players.map((id) => {
              const answer = view.answers[id]?.[c]?.trim() ?? "";
              const fits = valid.includes(id);
              const key = `${c}:${id}`;
              const struck = !fits || rejected?.has(key) || (scored && view.roundScores[id]?.[c] === 0);
              const same = fits ? valid.filter((q) => pmNormalize(view.answers[q][c]) === pmNormalize(answer)).length : 0;
              const canToggle = onToggle && fits && id !== me;
              const Row = canToggle ? "button" : "div";
              return (
                <Row
                  key={id}
                  {...(canToggle && { type: "button" as const, onClick: () => onToggle(key), "aria-pressed": rejected?.has(key) })}
                  className={`flex min-h-10 items-center gap-3 rounded-[10px] px-2 text-left ${canToggle ? "active:bg-surface" : ""}`}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: player(id)?.color }} aria-label={player(id)?.nick} />
                  <span className={`flex-1 ${struck ? "text-fg-subtle line-through" : ""}`}>{answer || "brak"}</span>
                  {same > 1 && !struck && <span className="font-mono text-xs text-fg-muted">x{same}</span>}
                  {scored && <span className="w-8 text-right font-mono">{view.roundScores[id]?.[c] ?? 0}</span>}
                </Row>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
