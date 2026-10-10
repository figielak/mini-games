import { ArrowLeft, Check, Play, ShareNetwork, SignOut } from "@phosphor-icons/react";
import { GAMES, type RoomView } from "@mini-games/games";
import { useState } from "react";
import { BLURBS, ICONS, Players, seats, StartBar } from "./Lobby.tsx";
import { Screen, type Send } from "./ui.tsx";

interface Props {
  view: RoomView;
  me: string;
  dropped: boolean;
  send: Send;
  onLeave: () => void;
}

/** Ekran gry głównej przed partią: opis, tryb, gracze i start. Gospodarz ustawia, goście widzą to samo tylko do odczytu. */
export function Setup({ view, me, dropped, send, onLeave }: Props) {
  const isHost = view.hostId === me;
  const def = GAMES[view.gameId!];
  const GameIcon = ICONS[def.id] ?? Play;
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${location.origin}/?kod=${view.code}`;
    if (navigator.share) {
      // Anulowanie arkusza udostępniania to nie błąd.
      await navigator.share({ title: "Gry", text: `Dołącz do pokoju ${view.code}`, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen dropped={dropped}>
      <div className="flex items-center justify-between">
        {isHost ? (
          <button type="button" className="-ml-2 flex min-h-12 items-center gap-1.5 px-2 text-sm text-fg-muted" onClick={() => send("pickGame", { gameId: null })}>
            <ArrowLeft size={16} aria-hidden />
            Gry
          </button>
        ) : (
          <button type="button" className="-ml-2 flex min-h-12 items-center gap-1.5 px-2 text-sm text-fg-muted" onClick={onLeave}>
            <SignOut size={16} aria-hidden />
            Wyjdź
          </button>
        )}
        <button type="button" className="-mr-2 flex min-h-12 items-center gap-2 px-2" onClick={share} aria-label={`Kod pokoju ${view.code}, udostępnij link`}>
          <span className="text-sm text-fg-muted">{copied ? "Skopiowano!" : "Kod"}</span>
          <span className="font-mono text-lg font-medium tracking-[0.12em]">{view.code}</span>
          {copied ? <Check size={16} weight="bold" aria-hidden /> : <ShareNetwork size={16} weight="bold" aria-hidden />}
        </button>
      </div>

      <section className="tile">
        <div className="flex items-center gap-3">
          <GameIcon size={28} weight="fill" className="shrink-0" aria-hidden />
          <div className="min-w-0">
            <h1 className="leading-tight">{def.name}</h1>
            <p className="font-mono text-xs text-fg-muted">{seats(def)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-fg-muted">{BLURBS[def.id]}</p>
      </section>

      {def.modes && (
        <section className="flex flex-col gap-2" role="radiogroup" aria-label="Tryb">
          <h2 className="label px-1">Tryb</h2>
          {def.modes.map((m) => {
            const on = view.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!isHost}
                className={`flex min-h-12 flex-col items-start justify-center rounded-inset border px-3 py-2 text-left transition-colors ${
                  on ? "border-accent bg-accent-soft" : "border-line enabled:hover:border-line-hover disabled:opacity-50"
                }`}
                onClick={() => send("pickMode", { mode: m.id })}
              >
                <span className="leading-tight">{m.name}</span>
                <span className="font-mono text-xs text-fg-muted">{m.hint}</span>
              </button>
            );
          })}
        </section>
      )}

      <Players view={view} me={me} send={send} />
      <StartBar view={view} me={me} send={send} />
    </Screen>
  );
}
