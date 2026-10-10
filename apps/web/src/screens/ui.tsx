import { ArrowLeft, Check, HandTap, ShareNetwork, SignOut, Timer, Trophy, WifiSlash } from "@phosphor-icons/react";
import type { RoomView } from "@mini-games/games";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

export type Send = (type: string, payload?: unknown) => void;

/** Wspólny układ ekranu: jedna kolumna, akcje przy dolnej krawędzi (strefa kciuka). */
export function Screen({ dropped, children }: { dropped: boolean; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-3 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {dropped && (
        <p role="status" className="flex items-center gap-2 rounded-inset bg-accent-soft px-4 py-3 text-sm">
          <WifiSlash size={18} aria-hidden />
          Łączenie ponownie…
        </p>
      )}
      {children}
    </main>
  );
}

/** Górny wiersz ekranów przed partią: gospodarz wraca do listy gier, gość wychodzi z pokoju; po prawej kod pokoju z udostępnianiem. */
export function TopBar({ code, onBack, onLeave }: { code: string; onBack?: () => void; onLeave: () => void }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${location.origin}/?kod=${code}`;
    if (navigator.share) {
      // Anulowanie arkusza udostępniania to nie błąd.
      await navigator.share({ title: "Gry", text: `Dołącz do pokoju ${code}`, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between">
      <button type="button" className="-ml-2 flex min-h-12 items-center gap-1.5 px-2 text-sm text-fg-muted" onClick={onBack ?? onLeave}>
        {onBack ? <ArrowLeft size={16} aria-hidden /> : <SignOut size={16} aria-hidden />}
        {onBack ? "Gry" : "Wyjdź"}
      </button>
      <button type="button" className="-mr-2 flex min-h-12 items-center gap-2 px-2" onClick={share} aria-label={`Kod pokoju ${code}, udostępnij link`}>
        <span className="text-sm text-fg-muted">{copied ? "Skopiowano!" : "Kod"}</span>
        <span className="font-mono text-lg font-medium tracking-[0.12em]">{code}</span>
        {copied ? <Check size={16} weight="bold" aria-hidden /> : <ShareNetwork size={16} weight="bold" aria-hidden />}
      </button>
    </div>
  );
}

/** Wyniki mini-gry: wiersz na gracza, w kolejności rankingu po końcu partii. */
export function Scores({ rows }: { rows: { id: string; nick: string; color?: string; me: boolean; score: string | null }[] }) {
  return (
    <ol className="tile flex flex-col gap-1 p-4">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
          <span className="flex-1">
            {r.nick}
            {r.me && <span className="text-fg-muted"> (ty)</span>}
          </span>
          <span className={`font-mono ${r.score === null ? "text-fg-muted" : ""}`}>{r.score ?? "gra…"}</span>
        </li>
      ))}
    </ol>
  );
}

/** Pasek statystyk nad planszą mini-gry: każda liczba ma etykietę, `warn` barwi wartość (kara, błędy). */
export function Stats({ items }: { items: { label: string; value: ReactNode; warn?: boolean }[] }) {
  return (
    <dl className="flex justify-between gap-3 rounded-inset border border-line bg-surface px-4 py-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center first:items-start last:items-end">
          <dt className="label">{item.label}</dt>
          <dd className={`font-mono text-lg leading-tight font-semibold tabular-nums ${item.warn ? "text-warning" : ""}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Przycisk przyklejony do dołu ekranu: przy otwartej klawiaturze i długiej liście zostaje pod kciukiem. */
export function StickyBar({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 -mx-4 flex items-center gap-3 bg-bg/90 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">{children}</div>;
}

/** To, czego ekran instrukcji potrzebuje z pokoju; podaje `Game.tsx`, żeby nie przeciągać tego przez propsy każdej gry. */
export const IntroContext = createContext<{
  game: NonNullable<RoomView["game"]>;
  others: { id: string; nick: string; color: string; began: boolean }[];
  begin: () => void;
} | null>(null);

/**
 * Ekran instrukcji mini-gry: podgląd, trzy punkty (czas, co zrobić, jak liczone są punkty) i „Start”.
 * Limit gry jeszcze nie tyka; gdy serwer zamknie instrukcję (wszyscy wystartowali albo minęło INTRO_SECONDS), gra rusza sama.
 */
export function Intro({ time, task, score, preview, onStart }: { time: ReactNode; task: ReactNode; score: ReactNode; preview: ReactNode; onStart: () => void }) {
  const room = useContext(IntroContext);
  const live = room?.game.intro ?? false;
  // Termin od chwili odebrania wiadomości, jak w liczniku tury.
  const deadline = useMemo(() => (live && room?.game.msLeft != null ? Date.now() + room.game.msLeft : null), [room?.game]);
  const [now, setNow] = useState(Date.now);
  const seen = useRef(live);
  const started = useRef(false);

  function start() {
    if (started.current) return;
    started.current = true;
    room?.begin();
    onStart();
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Po odświeżeniu w trakcie partii instrukcja jest już zamknięta: wtedy nic nie rusza samo, tyka zwykły limit.
  useEffect(() => {
    if (live) seen.current = true;
    else if (seen.current) start();
  }, [live]);

  return (
    <section className="tile my-auto flex flex-col gap-4 p-4">
      <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-inset border border-line bg-bg" aria-hidden>
        {preview}
      </div>
      <ul className="flex flex-col gap-2">
        {(
          [
            [Timer, time],
            [HandTap, task],
            [Trophy, score],
          ] as const
        ).map(([PointIcon, text], i) => (
          <li key={i} className="flex items-start gap-3">
            <PointIcon size={20} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <button type="button" className="btn btn-primary w-full" onClick={start}>
          Start
        </button>
        {deadline !== null && (
          <p className="text-center text-sm text-fg-muted tabular-nums">Start automatycznie za {Math.max(0, Math.ceil((deadline - now) / 1000))} s</p>
        )}
      </div>
      {room && room.others.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-fg-muted" role="status">
          {room.others.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.nick} {p.began ? "już gra" : "czyta zasady"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
