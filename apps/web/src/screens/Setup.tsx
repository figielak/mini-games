import { Play } from "@phosphor-icons/react";
import { GAMES, type RoomView } from "@mini-games/games";
import { BLURBS, ICONS, Players, seats, StartBar } from "./Lobby.tsx";
import { Screen, type Send, TopBar } from "./ui.tsx";

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
  return (
    <Screen dropped={dropped}>
      <TopBar code={view.code} onBack={isHost ? () => send("pickGame", { gameId: null }) : undefined} onLeave={onLeave} />

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
