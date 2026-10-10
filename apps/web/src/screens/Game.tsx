import { ArrowCounterClockwise, ArrowRight, Check, Timer, Trophy, UsersThree } from "@phosphor-icons/react";
import { CHINCZYK_TRACK, type ChinczykView, GAMES, type InnyView, isDone, type KampusTourView, type KatView, type KolorView, type KoloView, type KropkiView, type LiczenieView, type MapaView, type MemoryView, type ObrotView, type PanstwaMiastaView, type PiecWRzedzieView, QUIZ_DURATION_MS, type RefleksView, type RokView, type RoomView, type RytmView, type SledzenieView, ROK_ROUNDS, SCHULTE_SIZE, type SchulteView, type SimonView, type SrodekView, standings, type StatkiView, type StojView, type StoperView, type StroopView, WIEZA_LEVELS, type WiezaView, winner as tournamentWinner } from "@mini-games/games";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Chinczyk } from "../games/Chinczyk.tsx";
import { KampusTour } from "../games/KampusTour.tsx";
import { Kolo } from "../games/Kolo.tsx";
import { Kolor } from "../games/Kolor.tsx";
import { Kat } from "../games/Kat.tsx";
import { Kropki } from "../games/Kropki.tsx";
import { Liczenie } from "../games/Liczenie.tsx";
import { Mapa } from "../games/Mapa.tsx";
import { Memory } from "../games/Memory.tsx";
import { Obrot } from "../games/Obrot.tsx";
import { PanstwaMiasta } from "../games/PanstwaMiasta.tsx";
import { PiecWRzedzie } from "../games/PiecWRzedzie.tsx";
import { Refleks } from "../games/Refleks.tsx";
import { Rok } from "../games/Rok.tsx";
import { Schulte } from "../games/Schulte.tsx";
import { Simon } from "../games/Simon.tsx";
import { Sledzenie } from "../games/Sledzenie.tsx";
import { Srodek } from "../games/Srodek.tsx";
import { FleetLeft, Statki } from "../games/Statki.tsx";
import { Inny } from "../games/Inny.tsx";
import { Stoj } from "../games/Stoj.tsx";
import { Rytm } from "../games/Rytm.tsx";
import { Stoper } from "../games/Stoper.tsx";
import { Stroop } from "../games/Stroop.tsx";
import { Wieza } from "../games/Wieza.tsx";
import { IntroContext, Screen, type Send } from "./ui.tsx";

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

  // Quizy (Kolor liter, Liczenie, Inny element): w rundzie pasek w nagłówku pokazuje jej 30 s zamiast limitu platformy.
  const [round, setRound] = useState<{ msLeft: number } | null>(null);
  const onRound = (msLeft: number | null) => setRound(msLeft === null ? null : { msLeft });
  // Poświata tła w kolorze gracza, na którego czekamy; poza turą jednej osoby zostaje akcent.
  const turnColor = view.phase === "playing" && game.waitingFor.length === 1 ? view.players.find((p) => p.id === game.waitingFor[0])?.color : undefined;
  useEffect(() => {
    if (!turnColor) return;
    document.body.style.setProperty("--ambient", turnColor);
    return () => {
      document.body.style.removeProperty("--ambient");
    };
  }, [turnColor]);

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
  // Memory zamiast punktów pokazuje zebrane pary.
  const memory = def.id === "memory" ? (game.view as MemoryView) : null;
  // Statki w trakcie partii zamiast punktów pokazują flotę (w bitwie: pozostałą).
  const fleet = def.id === "statki" && view.phase === "playing" ? (game.view as StatkiView) : null;
  // Tabela Schultego w trakcie partii zamiast punktów pokazuje postęp każdego gracza.
  const schulte = def.id === "schulte" && view.phase === "playing" ? (game.view as SchulteView) : null;
  // Policz kropki i Kąt tak samo: numer rundy każdego gracza.
  const kropki = (def.id === "kropki" || def.id === "kat") && view.phase === "playing" ? (game.view as KropkiView | KatView) : null;
  // Wieża: wysokość wieży każdego gracza (po oddaniu wyniku ta z wyniku).
  const wieza = def.id === "wieza" && view.phase === "playing" ? (game.view as WiezaView) : null;
  // Który rok? też.
  const rok = def.id === "rok" && view.phase === "playing" ? (game.view as RokView) : null;
  const myColor = view.players.find((p) => p.id === me)?.color;
  const winner = view.phase === "over" ? game.result?.winner : undefined;
  // Turniej: w nagłówku numer gry i punkty; po ostatniej grze tytuł ogłasza zwycięzcę turnieju, nie gry.
  const t = view.tournament;
  const table = t ? standings(t, view.seats) : null;
  const tournamentOver = !!t && view.phase === "over" && isDone(t);
  const champion = t && tournamentOver ? tournamentWinner(t, view.seats) : undefined;
  const headline = tournamentOver ? champion : winner;
  const winnerColor = view.players.find((p) => p.id === headline)?.color;
  // W trakcie gry `index` to gry już rozegrane, po grze obejmuje też tę na ekranie.
  const gameNo = t ? t.index + (view.phase === "playing" ? 1 : 0) : 0;

  // Państwa-miasta w trakcie partii mają własny nagłówek: runda, pasek czasu fazy, litera.
  const ownHeader = def.id === "panstwa-miasta" && view.phase === "playing";

  const status =
    tournamentOver
      ? champion
        ? champion === me
          ? "Wygrywasz turniej!"
          : `Turniej wygrywa ${nick(champion)}`
        : view.seats.length > 1
          ? "Turniej: remis"
          : "Koniec turnieju"
      : view.phase === "over"
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
          : MINI_GAMES.has(def.id)
            ? def.name // wszyscy grają naraz, więc to nie jest niczyj „ruch”
            : "Twój ruch!"
        : `Czekamy na: ${waitingNicks}`;

  const intro = {
    game,
    others: view.seats.filter((id) => id !== me).map((id) => ({ id, nick: nick(id), color: view.players.find((p) => p.id === id)?.color ?? "", began: game.began.includes(id) })),
    begin: () => send("begin"),
  };

  return (
    <IntroContext.Provider value={intro}>
      <Screen dropped={dropped}>
        {!ownHeader && (
          <header className="tile flex flex-col gap-3 p-4">
            {t && (
              <p className="label">
                Turniej · {t.extra && gameNo === t.games.length ? "dogrywka" : `gra ${gameNo}/${t.games.length}`}
                {view.phase === "over" && !tournamentOver && ` · ${def.name}`}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              {/* Koniec partii: tytuł w kolorze zwycięzcy; podbicie tylko u niego, przegrany dostaje spokojną wersję. */}
              <h1
                className={`origin-left text-xl font-semibold ${headline === me ? "animate-[title-pop_0.5s_cubic-bezier(0.2,0.8,0.4,1)]" : ""}`}
                style={{ color: headline ? winnerColor : myTurn ? myColor : undefined }}
              >
                {status}
              </h1>
            </div>
            {/* Na ekranie instrukcji limit jeszcze nie ruszył. Stoper i Rytm: tykający limit zdradzałby upływ sekund, więc grający go nie widzi. */}
            {view.phase === "playing" && !game.intro && !((def.id === "stoper" || def.id === "rytm") && myTurn) && (
              <Countdown
                game={round ?? game}
                total={round ? QUIZ_DURATION_MS / 1000 : (def.turn?.(game.view).seconds ?? def.turnSeconds)}
                color={myTurn ? myColor : undefined}
                label={round ? "Czas" : MINI_GAMES.has(def.id) ? "Limit" : undefined}
              />
            )}
            <ul className="flex flex-wrap gap-2">
              {view.seats.map((id) => {
                const p = view.players.find((pl) => pl.id === id);
                const active = id === winner || (view.phase === "playing" && game.waitingFor.includes(id));
                return (
                  <li
                    key={id}
                    className={`flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${fleet ? "w-full" : ""} ${
                      active ? "" : "border-transparent text-fg-muted"
                    }`}
                    style={active ? { borderColor: p?.color, backgroundColor: `color-mix(in srgb, ${p?.color} 16%, transparent)` } : undefined}
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: p?.color }} aria-hidden />
                    {nick(id)}
                    {id === me && " (ty)"}
                    {fleet?.phase === "placing" && fleet.boards[id].ready && <Check size={14} weight="bold" aria-label="gotowy" />}
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
                    ) : memory ? (
                      <span className="text-base font-semibold text-fg tabular-nums" aria-label={`Pary: ${memory.owner.filter((o) => o === id).length / 2}`}>
                        {memory.owner.filter((o) => o === id).length / 2}
                      </span>
                    ) : fleet ? (
                      <FleetLeft board={fleet.boards[id]} lengths={fleet.lengths} color={p?.color ?? "#8b8b92"} />
                    ) : schulte ? (
                      <Progress done={id in schulte.results ? SCHULTE_LAST : (schulte.progress[id] ?? 0)} total={SCHULTE_LAST} color={p?.color} />
                    ) : kropki ? (
                      <Progress done={id in kropki.results ? kropki.rounds.length : (kropki.progress[id] ?? 0)} total={kropki.rounds.length} color={p?.color} />
                    ) : wieza ? (
                      <Progress done={wieza.results[id]?.height ?? wieza.progress[id] ?? 0} total={WIEZA_LEVELS} color={p?.color} />
                    ) : rok ? (
                      <Progress done={id in rok.results ? ROK_ROUNDS : (rok.progress[id] ?? 0)} total={ROK_ROUNDS} color={p?.color} />
                    ) : table ? (
                      <span className="font-mono text-sm font-semibold text-fg tabular-nums" aria-label={`Punkty w turnieju: ${table.find((r) => r.id === id)?.total ?? 0}`}>
                        {table.find((r) => r.id === id)?.total ?? 0} pkt
                      </span>
                    ) : (
                      // Puchar odróżnia wygrane partie w pokoju od wyniku bieżącej partii.
                      <span className="relative flex items-center gap-1 text-base font-semibold text-fg tabular-nums" aria-label={`Wygrane partie: ${view.scores[id] ?? 0}`}>
                        <Trophy size={14} weight="fill" className="text-fg-muted" aria-hidden />
                        {/* Klucz z wyniku: po wygranej liczba montuje się od nowa i wskakuje. */}
                        <span key={view.scores[id] ?? 0} className={id === winner ? "animate-[stone-pop_0.5s_ease-out]" : ""}>
                          {view.scores[id] ?? 0}
                        </span>
                        {id === winner && (
                          <span
                            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 animate-[float-up_1.6s_ease-out_forwards] font-mono text-sm"
                            style={{ color: p?.color }}
                            aria-hidden
                          >
                            +1
                          </span>
                        )}
                      </span>
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

        {def.id === "memory" && <Memory view={game.view as MemoryView} players={view.players} canMove={myTurn} onMove={(move) => send("move", move)} />}

        {/* Klucz z wylosowanego wyzwania: rewanż montuje grę od nowa, bez stanu poprzedniej partii. */}
        {def.id === "refleks" && (
          <Refleks
            key={(game.view as RefleksView).delays.join()}
            view={game.view as RefleksView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            winner={winner}
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

        {def.id === "kat" && (
          <Kat
            key={JSON.stringify((game.view as KatView).rounds)}
            view={game.view as KatView}
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

        {def.id === "rok" && (
          <Rok
            key={JSON.stringify((game.view as RokView).events)}
            view={game.view as RokView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            onMove={(move) => send("move", move)}
          />
        )}

        {def.id === "srodek" && (
          <Srodek
            key={JSON.stringify((game.view as SrodekView).segments)}
            view={game.view as SrodekView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            onMove={(move) => send("move", move)}
          />
        )}

        {def.id === "mapa" && (
          <Mapa
            key={(game.view as MapaView).cities.map((c) => c.name).join()}
            view={game.view as MapaView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            onMove={(move) => send("move", move)}
          />
        )}

        {def.id === "stoj" && (
          <Stoj
            key={(game.view as StojView).reds.join()}
            view={game.view as StojView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            winner={winner}
            onMove={(move) => send("move", move)}
          />
        )}

        {def.id === "sledzenie" && (
          <Sledzenie
            key={JSON.stringify((game.view as SledzenieView).rounds)}
            view={game.view as SledzenieView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            onMove={(move) => send("move", move)}
          />
        )}

        {def.id === "rytm" && (
          <Rytm
            key={(game.view as RytmView).nonce}
            view={game.view as RytmView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            onMove={(move) => send("move", move)}
          />
        )}

        {def.id === "wieza" && (
          <Wieza
            key={JSON.stringify((game.view as WiezaView).sides)}
            view={game.view as WiezaView}
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

        {def.id === "obrot" && (
          <Obrot
            key={(game.view as ObrotView).trials.map((t) => +t.mirror).join("")}
            view={game.view as ObrotView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            winner={winner}
            onMove={(move) => send("move", move)}
            onRound={onRound}
          />
        )}

        {def.id === "inny" && (
          <Inny
            key={(game.view as InnyView).trials.map((t) => t.odd).join()}
            view={game.view as InnyView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            winner={winner}
            onMove={(move) => send("move", move)}
            onRound={onRound}
          />
        )}

        {def.id === "stroop" && (
          <Stroop
            key={(game.view as StroopView).trials.map((t) => t.word * 4 + t.ink).join("")}
            view={game.view as StroopView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            winner={winner}
            onMove={(move) => send("move", move)}
            onRound={onRound}
          />
        )}

        {def.id === "liczenie" && (
          <Liczenie
            key={(game.view as LiczenieView).problems.map((p) => p.text).join()}
            view={game.view as LiczenieView}
            me={me}
            players={view.players}
            ranking={game.result?.ranking}
            winner={winner}
            onMove={(move) => send("move", move)}
            onRound={onRound}
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

        {view.phase === "over" && t && table && (
          <section className="tile p-4">
            <h2 className="label mb-2">{tournamentOver ? "Wyniki turnieju" : "Tabela turnieju"}</h2>
            <ol className="flex flex-col gap-1">
              {table.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3">
                  <span className="w-5 font-mono text-fg-muted">{i + 1}.</span>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: view.players.find((p) => p.id === r.id)?.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {nick(r.id)}
                    {r.id === me && <span className="text-fg-muted"> (ty)</span>}
                  </span>
                  {tournamentOver ? (
                    <span className="flex items-center gap-1 font-mono text-sm text-fg-muted" aria-label={`Wygrane gry: ${r.wins}`}>
                      <Trophy size={14} weight="fill" aria-hidden />
                      {r.wins}
                    </span>
                  ) : (
                    <span className="font-mono text-sm text-fg-muted" aria-label={`Za tę grę: ${r.last}`}>
                      +{r.last}
                    </span>
                  )}
                  <span className="w-14 text-right font-mono font-semibold tabular-nums">{r.total} pkt</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {view.phase === "over" && (
          <div className="mt-auto flex flex-col gap-2 pt-4">
            {t && !tournamentOver ? <NextActions view={view} me={me} send={send} countdown={<Countdown game={game} />} /> : <OverActions view={view} me={me} send={send} />}
          </div>
        )}
      </Screen>
    </IntroContext.Provider>
  );
}

const MINI_GAMES = new Set(["refleks", "simon", "stoper", "schulte", "stroop", "liczenie", "kolo", "kolor", "kropki", "rok", "srodek", "stoj", "sledzenie", "wieza", "rytm", "inny", "obrot", "mapa", "kat", "panstwa-miasta"]);

const SCHULTE_LAST = SCHULTE_SIZE * SCHULTE_SIZE;

/** Cienki pasek i licznik postępu (znalezione liczby, rundy) w pigułce gracza. */
function Progress({ done, total, color }: { done: number; total: number; color?: string }) {
  return (
    <>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className="block h-full rounded-full transition-[width] duration-200" style={{ width: `${(done / total) * 100}%`, backgroundColor: color }} />
      </span>
      <span className="font-mono text-xs text-fg tabular-nums">
        {done}/{total}
      </span>
    </>
  );
}

/** Rewanż rusza, gdy kliknie go każdy grający; „Do lobby” od jednej osoby kończy serię. */
function OverActions({ view, me, send }: { view: RoomView; me: string; send: Send }) {
  const seated = view.players.filter((p) => view.seats.includes(p.id));
  const wants = seated.filter((p) => p.ready);
  const waiting = seated.filter((p) => !p.ready);
  const iWant = wants.some((p) => p.id === me);
  return (
    <>
      {wants.length > 0 && !iWant && (
        <p className="basis-full text-center text-sm" role="status">
          {wants.map((p) => p.nick).join(", ")} {wants.length === 1 ? "chce" : "chcą"} rewanżu
        </p>
      )}
      {view.seats.includes(me) && (
        <button
          type="button"
          className={`btn btn-primary flex-1 ${wants.length > 0 && !iWant ? "animate-[ring-pulse_1.2s_ease-in-out_infinite] outline-2 outline-accent" : ""}`}
          disabled={iWant}
          onClick={() => send("rematch")}
        >
          <ArrowCounterClockwise size={18} weight="bold" aria-hidden />
          {iWant ? `Czekamy na: ${waiting.map((p) => p.nick).join(", ")}…` : "Rewanż"}
        </button>
      )}
      <button type="button" className="btn btn-ghost flex-1" onClick={() => send("toLobby")}>
        Do lobby
      </button>
    </>
  );
}

/** Między grami turnieju: „Dalej” od wszystkich grających odpala następną grę od razu, inaczej rusza sama po limicie. */
function NextActions({ view, me, send, countdown }: { view: RoomView; me: string; send: Send; countdown: ReactNode }) {
  const t = view.tournament!;
  const waiting = view.players.filter((p) => view.seats.includes(p.id) && !p.ready);
  const iWant = view.seats.includes(me) && !waiting.some((p) => p.id === me);
  return (
    <>
      <p className="flex items-center justify-center gap-3 text-sm" role="status">
        <span>
          Następna gra: <span className="font-semibold">{t.extra && t.index === t.games.length - 1 ? "dogrywka, " : ""}{GAMES[t.games[t.index]]?.name}</span>
        </span>
        {countdown}
      </p>
      {view.seats.includes(me) && (
        <button type="button" className="btn btn-primary w-full" disabled={iWant} onClick={() => send("rematch")}>
          {!iWant && <ArrowRight size={18} weight="bold" aria-hidden />}
          <span className="truncate">{iWant ? `Czekamy na: ${waiting.map((p) => p.nick).join(", ")}…` : "Dalej"}</span>
        </button>
      )}
      {view.hostId === me && (
        <button type="button" className="btn btn-ghost w-full" onClick={() => send("toLobby")}>
          Zakończ turniej
        </button>
      )}
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
 * `label`: podpis przed paskiem (mini-gry mają własny zegar partii, więc limit platformy musi być nazwany).
 */
function Countdown({ game, total, tense, color, label }: { game: { msLeft: number | null }; total?: number; tense?: boolean; color?: string; label?: string }) {
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
        {label && <span className="label">{label}</span>}
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Czas tury" aria-valuenow={seconds}>
          <div
            className={`h-full rounded-full transition-[width] duration-300 ease-linear ${seconds <= 10 ? "animate-pulse bg-warning" : tense ? "bg-accent" : "bg-fg-muted"}`}
            style={{ width: `${Math.min(1, left) * 100}%`, backgroundColor: seconds > 10 ? color : undefined }}
          />
        </div>
        {/* Twarda spacja i min-w: trzycyfrowy limit („173 s”) nie ściska się ani nie łamie w wąskim polu. */}
        <span className={`min-w-10 text-right text-sm font-medium whitespace-nowrap tabular-nums ${seconds <= 10 ? "text-warning" : "text-fg"}`}>{seconds}{"\u00a0"}s</span>
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
