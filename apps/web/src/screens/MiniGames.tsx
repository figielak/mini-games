import { Play } from "@phosphor-icons/react";
import { GAMES, type RoomView } from "@mini-games/games";
import { BLURBS, GameTile, ICONS, MINI_GAMES, Players, seats, StartBar } from "./Lobby.tsx";
import { Screen, type Send, TopBar } from "./ui.tsx";

interface Props {
  view: RoomView;
  me: string;
  dropped: boolean;
  send: Send;
  onLeave: () => void;
  onBack: () => void;
}

/** Lista mini-gier: gospodarz wybiera jedną i daje start, gość widzi opis wybranej. Zasady mini-gier są narzucone z góry. */
export function MiniGames({ view, me, dropped, send, onLeave, onBack }: Props) {
  const isHost = view.hostId === me;
  const def = view.gameId ? GAMES[view.gameId] : undefined;
  const DefIcon = (def && ICONS[def.id]) || Play;

  return (
    <Screen dropped={dropped}>
      <TopBar code={view.code} onBack={isHost ? onBack : undefined} onLeave={onLeave} />

      {isHost && (
        <section>
          <h2 className="label mb-2 px-1">Mini-gry</h2>
          <div className="grid grid-cols-2 gap-2">
            {MINI_GAMES.map((g) => (
              <GameTile key={g.id} game={g} players={view.players.length} picked={view.gameId === g.id} onClick={() => send("pickGame", { gameId: g.id })} />
            ))}
          </div>
        </section>
      )}

      {!isHost && def && (
        <section className="tile">
          <h2 className="label mb-3">Wybrana gra</h2>
          <div className="flex items-center gap-3">
            <DefIcon size={28} weight="fill" className="shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="leading-tight">{def.name}</p>
              <p className="font-mono text-xs text-fg-muted">{seats(def)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-fg-muted">{BLURBS[def.id]}</p>
        </section>
      )}

      <Players view={view} me={me} send={send} />
      <StartBar view={view} me={me} send={send} />
    </Screen>
  );
}
