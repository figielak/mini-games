import { ArrowCounterClockwise, Timer, UsersThree } from "@phosphor-icons/react";
import { type ChinczykView, GAMES, type PiecWRzedzieView, type RoomView, type StatkiView } from "@mini-games/games";
import { useEffect, useMemo, useState } from "react";
import { Chinczyk } from "../games/Chinczyk.tsx";
import { PiecWRzedzie } from "../games/PiecWRzedzie.tsx";
import { Statki } from "../games/Statki.tsx";
import { Screen, type Send } from "./ui.tsx";

interface Props {
  view: RoomView;
  me: string;
  dropped: boolean;
  send: Send;
}

export function Game({ view, me, dropped, send }: Props) {
  const game = view.game!;
  const def = GAMES[view.gameId!];
  const nick = (id: string | undefined) => view.players.find((p) => p.id === id)?.nick ?? "Gracz";
  const seated = view.seats.includes(me);
  const myTurn = view.phase === "playing" && game.waitingFor.includes(me);
  const waitingNicks = game.waitingFor.filter((id) => id !== me).map(nick).join(" i ");

  // Tryb wykładowy: krótka wibracja zamiast dźwięku, gdy przychodzi moja tura.
  useEffect(() => {
    if (myTurn) navigator.vibrate?.(40);
  }, [myTurn]);

  const status =
    view.phase === "over"
      ? game.result?.winner
        ? game.result.winner === me
          ? "Wygrywasz!"
          : `Wygrywa ${nick(game.result.winner)}`
        : "Remis"
      : myTurn
        ? (game.view as { phase?: string }).phase === "placing"
          ? "Ustaw statki"
          : "Twoja tura"
        : `Czekamy na: ${waitingNicks}`;

  return (
    <Screen dropped={dropped}>
      <header className="tile flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{status}</h1>
          {view.phase === "playing" && <Countdown game={game} />}
        </div>
        <ul className="flex flex-wrap gap-2">
          {view.seats.map((id) => {
            const p = view.players.find((pl) => pl.id === id);
            const active = view.phase === "playing" && game.waitingFor.includes(id);
            return (
              <li
                key={id}
                className={`flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${
                  active ? "border-line-hover bg-surface" : "border-transparent text-fg-muted"
                }`}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: p?.color }} aria-hidden />
                {nick(id)}
                {id === me && " (ty)"}
                <span className="font-mono">{view.scores[id] ?? 0}</span>
              </li>
            );
          })}
        </ul>
        {!seated && (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <UsersThree size={16} aria-hidden />
            Oglądasz
          </p>
        )}
      </header>

      {def.id === "piec-w-rzedzie" && (
        <PiecWRzedzie
          view={game.view as PiecWRzedzieView}
          players={view.players}
          canMove={myTurn}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "statki" && (
        <Statki
          view={game.view as StatkiView}
          me={me}
          players={view.players}
          canMove={myTurn}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "chinczyk" && (
        <Chinczyk
          view={game.view as ChinczykView}
          me={me}
          players={view.players}
          canMove={myTurn}
          onMove={(move) => send("move", move)}
        />
      )}

      {view.phase === "over" && game.result?.ranking && game.result.ranking.length > 2 && (
        <ol className="tile flex flex-col gap-1 p-4">
          {game.result.ranking.map((id, i) => (
            <li key={id} className="flex items-center gap-3">
              <span className="w-5 font-mono text-fg-muted">{i + 1}.</span>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: view.players.find((p) => p.id === id)?.color }} aria-hidden />
              {nick(id)}
              {id === me && <span className="text-fg-muted"> (ty)</span>}
            </li>
          ))}
        </ol>
      )}

      {view.phase === "over" && (
        <div className="mt-auto flex flex-col gap-2 pt-4">
          {view.hostId === me ? (
            <>
              <button type="button" className="btn btn-primary w-full" onClick={() => send("rematch")}>
                <ArrowCounterClockwise size={18} weight="bold" aria-hidden />
                Rewanż
              </button>
              <button type="button" className="btn btn-ghost w-full" onClick={() => send("toLobby")}>
                Do lobby
              </button>
            </>
          ) : (
            <p className="text-center text-sm text-fg-muted">Czekamy na decyzję gospodarza.</p>
          )}
        </div>
      )}
    </Screen>
  );
}

/**
 * Sekundy do końca tury. Liczone od chwili odebrania wiadomości, nie od zegara serwera.
 * Termin zależy od obiektu wiadomości, nie od liczby: każda nowa tura przychodzi z tym samym msLeft (60000).
 */
function Countdown({ game }: { game: NonNullable<RoomView["game"]> }) {
  const deadline = useMemo(() => (game.msLeft === null ? null : Date.now() + game.msLeft), [game]);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (deadline === null) return null;
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span className={`flex items-center gap-1 font-mono text-sm ${seconds <= 10 ? "text-accent" : "text-fg-muted"}`}>
      <Timer size={16} aria-hidden />
      {seconds}s
    </span>
  );
}
