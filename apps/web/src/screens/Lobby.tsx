import { Check, Crown, ShareNetwork, SignOut, WifiSlash } from "@phosphor-icons/react";
import { type LobbyView, MAX_PLAYERS } from "@mini-games/games";
import { useState } from "react";

interface Props {
  view: LobbyView | null;
  me: string;
  dropped: boolean;
  onLeave: () => void;
}

export function Lobby({ view, me, dropped, onLeave }: Props) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-3 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {dropped && (
        <p role="status" className="flex items-center gap-2 rounded-inset bg-accent-soft px-4 py-3 text-sm">
          <WifiSlash size={18} aria-hidden />
          Łączenie ponownie…
        </p>
      )}

      {view ? <Code code={view.code} /> : <div className="tile h-36 animate-pulse" aria-label="Wczytywanie" />}

      <section className="tile">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">Gracze</h2>
          {view && (
            <span className="font-mono text-sm text-fg-muted">
              {view.players.length}/{MAX_PLAYERS}
            </span>
          )}
        </div>
        {view ? (
          <ul className="flex flex-col gap-1">
            {view.players.map((p) => (
              <li
                key={p.id}
                className={`flex min-h-11 items-center gap-3 rounded-inset px-3 transition-opacity ${p.connected ? "" : "opacity-50"}`}
                style={{ backgroundColor: `color-mix(in srgb, ${p.color} 10%, transparent)` }}
              >
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                <span className="truncate">
                  {p.nick}
                  {p.id === me && <span className="text-fg-muted"> (ty)</span>}
                </span>
                <span className="ml-auto flex items-center gap-2 text-sm text-fg-muted">
                  {!p.connected && "rozłączony"}
                  {p.id === view.hostId && <Crown size={18} weight="fill" aria-label="Gospodarz" />}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="h-11 animate-pulse rounded-inset bg-surface-inset" />
        )}
        {view?.players.length === 1 && (
          <p className="mt-3 text-sm text-fg-muted">Podaj znajomym kod pokoju, żeby dołączyli.</p>
        )}
      </section>

      <section className="tile">
        <h2 className="label mb-2">Gra</h2>
        <p className="text-fg-muted">Wybór gry pojawi się wkrótce.</p>
      </section>

      <div className="mt-auto pt-6">
        <button type="button" className="btn btn-ghost w-full" onClick={onLeave}>
          <SignOut size={18} aria-hidden />
          Wyjdź z pokoju
        </button>
      </div>
    </main>
  );
}

function Code({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}/?kod=${code}`;

  async function share() {
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
    <section className="tile flex items-end justify-between gap-4">
      <div>
        <h2 className="label">Kod pokoju</h2>
        <p className="mt-1 font-mono text-6xl font-medium tracking-[0.12em]">{code}</p>
      </div>
      <button type="button" className="btn btn-primary shrink-0 px-4" onClick={share}>
        {copied ? <Check size={18} weight="bold" aria-hidden /> : <ShareNetwork size={18} weight="bold" aria-hidden />}
        {copied ? "Skopiowano" : "Udostępnij"}
      </button>
    </section>
  );
}
