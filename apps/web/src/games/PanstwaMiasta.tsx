import { Check, HandPalm, ThumbsDown } from "@phosphor-icons/react";
import { type LobbyPlayer, type PanstwaMiastaMove, type PanstwaMiastaView, PM_ANSWER_MAX, PM_CATEGORIES, pmFits, pmNormalize } from "@mini-games/games";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Scores } from "../screens/ui.tsx";

interface Props {
  view: PanstwaMiastaView;
  me: string;
  players: LobbyPlayer[];
  /** Na kogo czeka serwer: w nagłówku znaczek przy tych, którzy już skończyli. */
  waitingFor: string[];
  ranking?: string[];
  /** Pasek czasu fazy; bez niego (koniec partii) nagłówek gry chowa się, bo pokazuje go ekran gry. */
  timer?: ReactNode;
  onMove: (move: PanstwaMiastaMove) => void;
}

const DRAFT_MS = 500;
const PHASE_LABEL = { write: "Pisz", vote: "Głosowanie", summary: "Wyniki rundy", over: "Koniec" } as const;

export function PanstwaMiasta({ view, me, players, waitingFor, ranking, timer, onMove }: Props) {
  const player = (id: string) => players.find((p) => p.id === id);
  const letter = view.letters[view.round];
  const playing = view.players.includes(me);

  return (
    <div className="flex flex-col gap-3">
      {timer && (
        <header className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-semibold">
              Runda {view.round + 1}/{view.letters.length}
            </h1>
            <span className="text-sm text-fg-muted">{PHASE_LABEL[view.phase]}</span>
          </div>
          {timer}
          <div className="flex items-center gap-4">
            <span
              className="flex size-20 shrink-0 items-center justify-center rounded-[20px] border border-line-hover bg-surface text-6xl font-semibold"
              aria-label={`Litera ${letter}`}
            >
              {letter}
            </span>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {view.players.map((id) => (
                <li key={id} className={`flex items-center gap-1.5 ${waitingFor.includes(id) ? "text-fg-muted" : ""}`}>
                  <span className="size-2 rounded-full" style={{ backgroundColor: player(id)?.color }} aria-hidden />
                  {player(id)?.nick ?? "Gracz"}
                  {id === me && <span className="text-fg-muted">(ty)</span>}
                  {!waitingFor.includes(id) && <Check size={14} weight="bold" className="text-success" aria-label="gotowe" />}
                </li>
              ))}
              {!playing && <li className="text-fg-muted">Oglądasz</li>}
            </ul>
          </div>
        </header>
      )}

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
            <StickyBar>
              <button type="button" className="btn btn-primary w-full" disabled={view.ready.includes(me)} onClick={() => onMove({ type: "next" })}>
                {view.ready.includes(me) ? "Czekamy na resztę" : "Dalej"}
              </button>
            </StickyBar>
          )}
        </>
      )}
    </div>
  );
}

/** Przycisk przyklejony do dołu ekranu: przy otwartej klawiaturze i długiej liście zostaje pod kciukiem. */
function StickyBar({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 -mx-4 flex items-center gap-3 bg-bg/90 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">{children}</div>;
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
  const letter = view.letters[view.round];
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

  // Enter przechodzi do kolejnego pola; w ostatnim wysyła formularz.
  function enter(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== "Enter" || i === PM_CATEGORIES.length - 1) return;
    e.preventDefault();
    document.getElementById(`pm-${i + 1}`)?.focus();
  }

  const filled = answers.filter((a) => a.trim()).length;
  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div className="tile flex flex-col gap-4 p-4">
        {stopBy && <StopBanner nick={stopBy} />}
        {PM_CATEGORIES.map((category, i) => {
          const typed = answers[i].trim() !== "";
          const ok = typed && pmFits(letter, answers[i]);
          return (
            <div key={category} className="flex flex-col gap-1.5">
              <label htmlFor={`pm-${i}`} className="text-[13px] font-medium text-fg">
                {category}
              </label>
              <div className="relative">
                <input
                  id={`pm-${i}`}
                  className="field pr-10"
                  value={answers[i]}
                  placeholder={`${letter}…`}
                  maxLength={PM_ANSWER_MAX}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  enterKeyHint={i < PM_CATEGORIES.length - 1 ? "next" : "done"}
                  aria-invalid={typed && !ok}
                  onKeyDown={(e) => enter(e, i)}
                  onChange={(e) => change(i, e.target.value)}
                />
                {ok && <Check size={18} weight="bold" className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-success" aria-hidden />}
              </div>
            </div>
          );
        })}
      </div>
      <StickyBar>
        <span className="w-10 shrink-0 font-mono text-sm text-fg-muted" aria-label={`Wypełnione ${filled} z ${PM_CATEGORIES.length}`}>
          {filled}/{PM_CATEGORIES.length}
        </span>
        <button type="submit" className="btn btn-primary flex-1">
          {filled === PM_CATEGORIES.length && !view.stop ? "STOP!" : "Gotowe"}
        </button>
      </StickyBar>
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
      <StickyBar>
        <button type="button" className="btn btn-primary w-full" onClick={submit}>
          {rejected.size ? `Zatwierdź (odrzucam ${rejected.size})` : "Wszystko się zgadza"}
        </button>
      </StickyBar>
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
    <>
      {PM_CATEGORIES.map((category, c) => {
        const valid = view.players.filter((p) => pmFits(letter, view.answers[p]?.[c] ?? ""));
        return (
          <section key={category} className="tile flex flex-col gap-1 p-3">
            <h3 className="px-2 pb-1 font-semibold">{category}</h3>
            {view.players.map((id) => {
              const answer = view.answers[id]?.[c]?.trim() ?? "";
              const fits = valid.includes(id);
              const key = `${c}:${id}`;
              const struck = !fits || rejected?.has(key) || (scored && view.roundScores[id]?.[c] === 0);
              const same = fits ? valid.filter((q) => pmNormalize(view.answers[q][c]) === pmNormalize(answer)).length : 0;
              // Cudze głosy są jawne dopiero w podsumowaniu.
              const against = scored ? view.players.filter((v) => view.votes[v]?.some((x) => x.player === id && x.category === c)).length : 0;
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
                  {against > 0 && (
                    <span className="flex items-center gap-1 font-mono text-xs text-fg-muted" aria-label={`Przeciw: ${against}`}>
                      <ThumbsDown size={14} aria-hidden />
                      {against}
                    </span>
                  )}
                  {scored && <span className="w-8 text-right font-mono">{view.roundScores[id]?.[c] ?? 0}</span>}
                </Row>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
