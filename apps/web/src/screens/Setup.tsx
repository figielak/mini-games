import { Check, Minus, Play, Plus, Trophy, X } from "@phosphor-icons/react";
import { GAMES, MAX_PLAYERS, MIN_LENGTH, type RoomView } from "@mini-games/games";
import { BLURBS, ICONS, MINI_GAMES, Players, seats, StartBar } from "./Lobby.tsx";
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

/**
 * Ekran turnieju przed startem: liczba gier (gospodarz) i dobór mini-gier. Każdą grę da się oznaczyć jako pewną albo wykluczoną,
 * resztę losuje serwer. Gry zaznacza każdy w pokoju, lista jest wspólna; spory gracze rozstrzygają między sobą.
 */
export function TournamentSetup({ view, me, dropped, send, onLeave }: Props) {
  const isHost = view.hostId === me;
  const { length, must, skip } = view.tournament!.config;
  const available = MINI_GAMES.length - skip.length;
  const pick = (config: { length: number }) => send("pickTournament", config);

  // Dotknięcie przełącza: losowo → na pewno → bez → losowo. Wykluczyć się nie da, gdy zostałoby za mało gier.
  function cycle(id: string) {
    const next = skip.includes(id) ? "any" : !must.includes(id) ? "must" : available > MIN_LENGTH ? "skip" : "any";
    send("markGame", { id, mark: next });
  }

  return (
    <Screen dropped={dropped}>
      <TopBar code={view.code} onBack={isHost ? () => send("pickGame", { gameId: null }) : undefined} onLeave={onLeave} />

      <section className="tile">
        <div className="flex items-center gap-3">
          <Trophy size={28} weight="fill" className="shrink-0" aria-hidden />
          <div className="min-w-0">
            <h1 className="leading-tight">Turniej</h1>
            <p className="font-mono text-xs text-fg-muted">1-{MAX_PLAYERS} os.</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-fg-muted">Seria mini-gier po kolei. Za każdą grę dostajesz punkt za każdego pokonanego rywala, wygrywa najwięcej punktów.</p>
      </section>

      <section className="tile flex items-center justify-between gap-3">
        <h2 className="label" id="tournament-length">
          Liczba gier
        </h2>
        <div className="flex items-center gap-3" role="group" aria-labelledby="tournament-length">
          {isHost && (
            <button
              type="button"
              className="btn btn-ghost size-12 shrink-0 p-0"
              disabled={length <= Math.max(MIN_LENGTH, must.length)}
              onClick={() => pick({ length: length - 1 })}
              aria-label="Mniej gier"
            >
              <Minus size={18} weight="bold" aria-hidden />
            </button>
          )}
          <span className="min-w-8 text-center font-mono text-2xl font-semibold tabular-nums" aria-live="polite">
            {length}
          </span>
          {isHost && (
            <button type="button" className="btn btn-ghost size-12 shrink-0 p-0" disabled={length >= available} onClick={() => pick({ length: length + 1 })} aria-label="Więcej gier">
              <Plus size={18} weight="bold" aria-hidden />
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="label px-1">Gry</h2>
        <p className="px-1 font-mono text-xs text-fg-muted">
          Na pewno: {must.length} · losowo: {length - must.length} z {available - must.length} · bez: {skip.length}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {MINI_GAMES.map((g) => {
            const state = must.includes(g.id) ? "na pewno" : skip.includes(g.id) ? "bez" : "losowo";
            const GameIcon = ICONS[g.id] ?? Play;
            return (
              <button
                key={g.id}
                type="button"
                aria-label={`${g.name}: ${state}`}
                className={`flex min-h-12 items-center gap-2 rounded-inset border px-3 py-2 text-left text-sm transition-colors ${
                  state === "na pewno" ? "border-accent bg-accent-soft" : state === "bez" ? "border-line text-fg-muted line-through opacity-50" : "border-line hover:border-line-hover"
                }`}
                onClick={() => cycle(g.id)}
              >
                <GameIcon size={18} className="shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 leading-tight">{g.name}</span>
                {state === "na pewno" && <Check size={16} weight="bold" className="shrink-0" aria-hidden />}
                {state === "bez" && <X size={16} weight="bold" className="shrink-0" aria-hidden />}
              </button>
            );
          })}
        </div>
        <p className="px-1 text-sm text-fg-muted">Lista jest wspólna, zaznaczać może każdy. Dotknij gry, żeby była na pewno; drugie dotknięcie ją wyklucza, trzecie wraca do losowania.</p>
      </section>

      <Players view={view} me={me} send={send} />
      <StartBar view={view} me={me} send={send} />
    </Screen>
  );
}
