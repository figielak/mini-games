import { ArrowCounterClockwise, Timer, UsersThree } from "@phosphor-icons/react";
import { CHINCZYK_TRACK, type ChinczykView, GAMES, type KampusTourView, type KolorView, type KoloView, type KropkiView, type LiczenieView, type PanstwaMiastaView, type PiecWRzedzieView, type RefleksView, type RoomView, type SchulteView, type SimonView, type StatkiView, type StoperView, type StroopView } from "@mini-games/games";
import { useEffect, useMemo, useState } from "react";
import { Chinczyk } from "../games/Chinczyk.tsx";
import { KampusTour } from "../games/KampusTour.tsx";
import { Kolo } from "../games/Kolo.tsx";
import { Kolor } from "../games/Kolor.tsx";
import { Kropki } from "../games/Kropki.tsx";
import { Liczenie } from "../games/Liczenie.tsx";
import { PanstwaMiasta } from "../games/PanstwaMiasta.tsx";
import { PiecWRzedzie } from "../games/PiecWRzedzie.tsx";
import { Refleks } from "../games/Refleks.tsx";
import { Schulte } from "../games/Schulte.tsx";
import { Simon } from "../games/Simon.tsx";
import { FleetLeft, Statki } from "../games/Statki.tsx";
import { Stoper } from "../games/Stoper.tsx";
import { Stroop } from "../games/Stroop.tsx";
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

  // Kampus Tour ma własny, poziomy układ na cały ekran: gracze w rogach, licznik i rewanż w środku planszy.
  if (def.id === "kampus-tour") {
    return (
      <KampusTour
        view={game.view as KampusTourView}
        me={me}
        players={view.players}
        dropped={dropped}
        canMove={myTurn}
        result={game.result}
        onMove={(move) => send("move", move)}
        timer={view.phase === "playing" && <Countdown game={game} total={def.turnSeconds} />}
        actions={view.phase === "over" && <OverActions view={view} me={me} send={send} />}
      />
    );
  }

  // Wspólny nagłówek: wyraźne „Twój ruch!” w kolorze gracza i pasek czasu. Chińczyk zamiast punktów pokazuje pionki w domu.
  const ludo = def.id === "chinczyk" ? (game.view as ChinczykView) : null;
  // Statki w bitwie zamiast punktów pokazują pozostałą flotę.
  const fleet = def.id === "statki" && (game.view as StatkiView).phase === "battle" ? (game.view as StatkiView) : null;
  const myColor = view.players.find((p) => p.id === me)?.color;

  // Państwa-miasta w trakcie partii mają własny nagłówek: runda, pasek czasu fazy, litera.
  const ownHeader = def.id === "panstwa-miasta" && view.phase === "playing";

  const status =
    view.phase === "over"
      ? game.result?.winner
        ? game.result.winner === me
          ? "Wygrywasz!"
          : `Wygrywa ${nick(game.result.winner)}`
        : game.result?.ranking?.length === 1
          ? "Koniec"
          : "Remis"
      : myTurn
        ? (game.view as { phase?: string }).phase === "placing"
          ? "Ustaw statki"
          : "Twój ruch!"
        : `Czekamy na: ${waitingNicks}`;

  return (
    <Screen dropped={dropped}>
      {!ownHeader && (
        <header className="tile flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold" style={myTurn ? { color: myColor } : undefined}>
              {status}
            </h1>
          </div>
          {view.phase === "playing" && <Countdown game={game} total={def.turnSeconds} color={myTurn ? myColor : undefined} />}
          <ul className="flex flex-wrap gap-2">
            {view.seats.map((id) => {
              const p = view.players.find((pl) => pl.id === id);
              const active = view.phase === "playing" && game.waitingFor.includes(id);
              return (
                <li
                  key={id}
                  className={`flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${fleet ? "w-full" : ""} ${
                    active ? "border-line-hover bg-surface" : "border-transparent text-fg-muted"
                  }`}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: p?.color }} aria-hidden />
                  {nick(id)}
                  {id === me && " (ty)"}
                  {ludo ? (
                    <span className="flex gap-1" aria-label={`W domu: ${ludo.pawns[id].filter((p) => p >= CHINCZYK_TRACK).length} z 4`}>
                      {[...ludo.pawns[id]].sort((a, b) => b - a).map((pos, i) => (
                        <span
                          key={i}
                          className="size-2.5 rounded-full border"
                          style={{ borderColor: p?.color, backgroundColor: pos >= CHINCZYK_TRACK ? p?.color : undefined }}
                          aria-hidden
                        />
                      ))}
                    </span>
                  ) : fleet ? (
                    <FleetLeft board={fleet.boards[id]} color={p?.color ?? "#8b8b92"} />
                  ) : (
                    <span className="font-mono">{view.scores[id] ?? 0}</span>
                  )}
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
      )}

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

      {/* Klucz z wylosowanego wyzwania: rewanż montuje grę od nowa, bez stanu poprzedniej partii. */}
      {def.id === "refleks" && (
        <Refleks
          key={(game.view as RefleksView).delays.join()}
          view={game.view as RefleksView}
          me={me}
          players={view.players}
          ranking={game.result?.ranking}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "stoper" && (
        <Stoper
          key={(game.view as StoperView).nonce}
          view={game.view as StoperView}
          me={me}
          players={view.players}
          ranking={game.result?.ranking}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "kolo" && (
        <Kolo
          key={(game.view as KoloView).nonce}
          view={game.view as KoloView}
          me={me}
          players={view.players}
          ranking={game.result?.ranking}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "kolor" && (
        <Kolor
          key={JSON.stringify((game.view as KolorView).targets)}
          view={game.view as KolorView}
          me={me}
          players={view.players}
          ranking={game.result?.ranking}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "kropki" && (
        <Kropki
          key={JSON.stringify((game.view as KropkiView).rounds)}
          view={game.view as KropkiView}
          me={me}
          players={view.players}
          ranking={game.result?.ranking}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "schulte" && (
        <Schulte
          key={(game.view as SchulteView).grid.join()}
          view={game.view as SchulteView}
          me={me}
          players={view.players}
          ranking={game.result?.ranking}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "stroop" && (
        <Stroop
          key={(game.view as StroopView).trials.map((t) => t.word * 4 + t.ink).join("")}
          view={game.view as StroopView}
          me={me}
          players={view.players}
          ranking={game.result?.ranking}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "liczenie" && (
        <Liczenie
          key={(game.view as LiczenieView).problems.map((p) => p.text).join()}
          view={game.view as LiczenieView}
          me={me}
          players={view.players}
          ranking={game.result?.ranking}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "simon" && (
        <Simon
          key={(game.view as SimonView).sequence.join("")}
          view={game.view as SimonView}
          me={me}
          players={view.players}
          ranking={game.result?.ranking}
          onMove={(move) => send("move", move)}
        />
      )}

      {def.id === "panstwa-miasta" && (
        <PanstwaMiasta
          key={(game.view as PanstwaMiastaView).nonce}
          view={game.view as PanstwaMiastaView}
          me={me}
          players={view.players}
          waitingFor={game.waitingFor}
          ranking={game.result?.ranking}
          timer={ownHeader && <Countdown game={game} total={def.turn?.(game.view).seconds} tense />}
          onMove={(move) => send("move", move)}
        />
      )}

      {/* Mini-gry pokazują ranking same, razem z wynikami. */}
      {view.phase === "over" && !MINI_GAMES.has(def.id) && game.result?.ranking && game.result.ranking.length > 2 && (
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
          <OverActions view={view} me={me} send={send} />
        </div>
      )}
    </Screen>
  );
}

const MINI_GAMES = new Set(["refleks", "simon", "stoper", "schulte", "stroop", "liczenie", "kolo", "kolor", "kropki", "panstwa-miasta"]);

/** Rewanż rusza, gdy kliknie go każdy grający; „Do lobby” od jednej osoby kończy serię. */
function OverActions({ view, me, send }: { view: RoomView; me: string; send: Send }) {
  const seated = view.players.filter((p) => view.seats.includes(p.id));
  const wants = seated.filter((p) => p.ready);
  const waiting = seated.filter((p) => !p.ready);
  const iWant = wants.some((p) => p.id === me);
  return (
    <>
      {wants.length > 0 && (
        <p className="basis-full text-center text-sm text-fg-muted" role="status">
          Rewanż chce: {wants.map((p) => p.nick).join(", ")}
          {waiting.length > 0 && <> · czekamy na: {waiting.map((p) => p.nick).join(", ")}</>}
        </p>
      )}
      {view.seats.includes(me) && (
        <button type="button" className="btn btn-primary flex-1" disabled={iWant} onClick={() => send("rematch")}>
          <ArrowCounterClockwise size={18} weight="bold" aria-hidden />
          {iWant ? "Czekamy na resztę" : "Rewanż"}
        </button>
      )}
      <button type="button" className="btn btn-ghost flex-1" onClick={() => send("toLobby")}>
        Do lobby
      </button>
    </>
  );
}

/**
 * Sekundy do końca tury. Liczone od chwili odebrania wiadomości, nie od zegara serwera.
 * Termin zależy od obiektu wiadomości, nie od liczby: każda nowa tura przychodzi z tym samym msLeft (60000).
 */
/**
 * `tense`: pasek w kolorze akcentu (gra na czas, np. Państwa-miasta), a nie spokojny szary.
 * `color`: pasek w kolorze gracza (moja tura). Czerwień i tak przychodzi na ostatnie 10 s.
 */
function Countdown({ game, total, tense, color }: { game: NonNullable<RoomView["game"]>; total?: number; tense?: boolean; color?: string }) {
  const deadline = useMemo(() => (game.msLeft === null ? null : Date.now() + game.msLeft), [game]);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (deadline === null) return null;
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  // Z podanym limitem tury: kurczący się pasek zamiast samej liczby.
  if (total) {
    const left = Math.max(0, deadline - now) / (total * 1000);
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Czas tury" aria-valuenow={seconds}>
          <div
            className={`h-full rounded-full transition-[width] duration-300 ease-linear ${seconds <= 10 ? "animate-pulse bg-warning" : tense ? "bg-accent" : "bg-fg-muted"}`}
            style={{ width: `${Math.min(1, left) * 100}%`, backgroundColor: seconds > 10 ? color : undefined }}
          />
        </div>
        <span className={`w-10 text-right font-mono text-xs ${seconds <= 10 ? "text-warning" : "text-fg-muted"}`}>{seconds} s</span>
      </div>
    );
  }
  return (
    <span className={`flex items-center gap-1 font-mono text-sm ${seconds <= 10 ? "text-warning" : "text-fg-muted"}`}>
      <Timer size={16} aria-hidden />
      {seconds} s
    </span>
  );
}
