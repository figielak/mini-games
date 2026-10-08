import { Check, Crown, Play, ShareNetwork, SignOut } from "@phosphor-icons/react";
import { GAMES, MAX_PLAYERS, PLAYER_COLORS, type RoomView } from "@mini-games/games";
import { useState } from "react";
import { Screen, type Send } from "./ui.tsx";

interface Props {
  view: RoomView | null;
  me: string;
  dropped: boolean;
  send: Send;
  onLeave: () => void;
}

export function Lobby({ view, me, dropped, send, onLeave }: Props) {
  const isHost = view?.hostId === me;
  const def = view?.gameId ? GAMES[view.gameId] : undefined;
  const startBlocker = !def
    ? "Wybierz grę."
    : view!.seats.length < def.minPlayers
      ? `Zaznacz ${def.minPlayers} graczy do gry.`
      : null;

  return (
    <Screen dropped={dropped}>
      {view ? <Code code={view.code} /> : <div className="tile h-36 animate-pulse" aria-label="Wczytywanie" />}

      <section className="tile">
        <h2 className="label mb-3">Gra</h2>
        {isHost ? (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Wybór gry">
            {Object.values(GAMES).map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={view?.gameId === g.id}
                className={`flex min-h-12 items-center justify-between rounded-inset border px-4 text-left transition-colors ${
                  view?.gameId === g.id ? "border-accent bg-accent-soft" : "border-line hover:border-line-hover"
                }`}
                onClick={() => send("pickGame", { gameId: g.id })}
              >
                {g.name}
                <span className="font-mono text-sm text-fg-muted">
                  {g.minPlayers === g.maxPlayers ? g.minPlayers : `${g.minPlayers}-${g.maxPlayers}`} os.
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className={def ? "" : "text-fg-muted"}>{def ? def.name : "Gospodarz wybiera grę."}</p>
        )}
      </section>

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
            {view.players.map((p) => {
              const seated = view.seats.includes(p.id);
              const row = (
                <>
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                  <span className="truncate">
                    {p.nick}
                    {p.id === me && <span className="text-fg-muted"> (ty)</span>}
                  </span>
                  <span className="ml-auto flex items-center gap-2 text-sm text-fg-muted">
                    {!p.connected && "rozłączony"}
                    {def && (seated ? <span className="text-fg">gra</span> : "ogląda")}
                    {p.id === view.hostId && <Crown size={18} weight="fill" aria-label="Gospodarz" />}
                  </span>
                </>
              );
              const className = `flex w-full min-h-11 items-center gap-3 rounded-inset px-3 text-left transition-opacity ${p.connected ? "" : "opacity-50"}`;
              const style = { backgroundColor: `color-mix(in srgb, ${p.color} ${seated || !def ? 10 : 4}%, transparent)` };
              return (
                <li key={p.id}>
                  {isHost && def ? (
                    <button
                      type="button"
                      className={className}
                      style={style}
                      aria-pressed={seated}
                      onClick={() => send("toggleSeat", { id: p.id })}
                    >
                      {row}
                    </button>
                  ) : (
                    <div className={className} style={style}>
                      {row}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="h-11 animate-pulse rounded-inset bg-surface-inset" />
        )}
        {view && <ColorPicker view={view} me={me} send={send} />}
        {view?.players.length === 1 && (
          <p className="mt-3 text-sm text-fg-muted">Podaj znajomym kod pokoju, żeby dołączyli.</p>
        )}
        {isHost && def && view!.players.length > 1 && (
          <p className="mt-3 text-sm text-fg-muted">Dotknij gracza, żeby zmienić, kto gra.</p>
        )}
      </section>

      <div className="mt-auto flex flex-col gap-2 pt-6">
        {isHost ? (
          <>
            {startBlocker && <p className="text-center text-sm text-fg-muted">{startBlocker}</p>}
            <button type="button" className="btn btn-primary w-full" disabled={!!startBlocker} onClick={() => send("start")}>
              <Play size={18} weight="fill" aria-hidden />
              Start
            </button>
          </>
        ) : (
          view && <p className="text-center text-sm text-fg-muted">Czekamy, aż gospodarz zacznie.</p>
        )}
        <button type="button" className="btn btn-ghost w-full" onClick={onLeave}>
          <SignOut size={18} aria-hidden />
          Wyjdź z pokoju
        </button>
      </div>
    </Screen>
  );
}

/** Nazwy kolorów z PLAYER_COLORS (ta sama kolejność), dla czytników ekranu. */
const COLOR_NAMES = ["niebieski", "żółty", "zielony", "fioletowy", "morski", "różowy"];

/** Wybór własnego koloru: zajęte przez innych są przygaszone i nieaktywne. */
function ColorPicker({ view, me, send }: { view: RoomView; me: string; send: Send }) {
  const mine = view.players.find((p) => p.id === me)?.color;
  return (
    <div className="mt-4 flex flex-col gap-1">
      <span className="text-sm text-fg-muted">Twój kolor</span>
      <div className="flex justify-between" role="radiogroup" aria-label="Twój kolor">
        {PLAYER_COLORS.map((color, i) => {
          const owner = view.players.find((p) => p.color === color);
          const taken = !!owner && owner.id !== me;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={color === mine}
              aria-label={taken ? `${COLOR_NAMES[i]}, zajęty: ${owner.nick}` : COLOR_NAMES[i]}
              disabled={taken}
              className="grid size-10 place-items-center rounded-full disabled:opacity-25"
              onClick={() => send("pickColor", { color })}
            >
              <span
                className={`grid size-7 place-items-center rounded-full ${color === mine ? "outline-2 outline-offset-2 outline-fg" : ""}`}
                style={{ backgroundColor: color }}
              >
                {color === mine && <Check size={14} weight="bold" className="text-bg" aria-hidden />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
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
