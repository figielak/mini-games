import {
  Boat,
  Buildings,
  Calculator,
  Check,
  CircleDashed,
  Crown,
  DiceFive,
  DotsNine,
  Eyedropper,
  GlobeHemisphereEast,
  GridNine,
  HandWaving,
  type Icon,
  Lightning,
  NumberSquareOne,
  Palette,
  Play,
  ShareNetwork,
  SignOut,
  SquaresFour,
  Timer,
} from "@phosphor-icons/react";
import { GAMES, MAX_PLAYERS, PLAYER_COLORS, type RoomView } from "@mini-games/games";
import { useState } from "react";
import { Screen, type Send, StickyBar } from "./ui.tsx";

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
  const hostNick = view?.players.find((p) => p.id === view.hostId)?.nick ?? "gospodarz";
  const guests = view?.seats.filter((id) => id !== view.hostId) ?? [];
  const readyCount = guests.filter((id) => view!.players.find((p) => p.id === id)?.ready).length;
  const meSeated = !!view?.seats.includes(me);
  const meReady = !!view?.players.find((p) => p.id === me)?.ready;
  const startBlocker = !def
    ? "Wybierz grę"
    : view!.seats.length < def.minPlayers
      ? `Zaznacz ${def.minPlayers} graczy do gry`
      : readyCount < guests.length
        ? `Czekamy na gotowość (${readyCount}/${guests.length})`
        : null;

  return (
    <Screen dropped={dropped}>
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
                    {def &&
                      (!seated ? (
                        "ogląda"
                      ) : p.ready || p.id === view.hostId ? (
                        <span className="flex items-center gap-1 text-fg">
                          <Check size={14} weight="bold" aria-hidden />
                          gotowy
                        </span>
                      ) : (
                        "niegotowy"
                      ))}
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

      {view &&
        GROUPS.map(([title, quick]) => (
          <section key={title}>
            <h2 className="label mb-2 px-1">{title}</h2>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={title}>
              {Object.values(GAMES)
                .filter((g) => (g.minPlayers === 1) === quick)
                .map((g) => {
                  const Icon = ICONS[g.id] ?? Play;
                  const tooMany = view.players.length > g.maxPlayers;
                  const picked = view.gameId === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={picked}
                      disabled={!isHost || tooMany}
                      className={`flex min-h-20 flex-col items-start gap-1 rounded-inset border p-3 text-left transition-colors ${
                        picked ? "border-accent bg-accent-soft" : "border-line enabled:hover:border-line-hover"
                      } ${tooMany ? "opacity-40" : ""}`}
                      onClick={() => send("pickGame", { gameId: g.id })}
                    >
                      <Icon size={22} weight={picked ? "fill" : "regular"} aria-hidden />
                      <span className="leading-tight">{g.name}</span>
                      <span className="font-mono text-xs text-fg-muted">
                        {tooMany
                          ? `max ${g.maxPlayers} os.`
                          : g.minPlayers === g.maxPlayers
                            ? `${g.minPlayers} os.`
                            : `${g.minPlayers}-${g.maxPlayers} os.`}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}

      <button type="button" className="btn btn-ghost mt-auto w-full" onClick={onLeave}>
        <SignOut size={18} aria-hidden />
        Wyjdź z pokoju
      </button>

      {view && (
        <StickyBar>
          {isHost ? (
            <button type="button" className="btn btn-primary w-full" disabled={!!startBlocker} onClick={() => send("start")}>
              {!startBlocker && <Play size={18} weight="fill" aria-hidden />}
              <span className="truncate">{startBlocker ?? `Zagraj: ${def!.name}`}</span>
            </button>
          ) : def && meSeated ? (
            <button
              type="button"
              className={`btn w-full ${meReady ? "btn-ghost" : "btn-primary"}`}
              aria-pressed={meReady}
              onClick={() => send("ready", { ready: !meReady })}
            >
              {meReady ? <Check size={18} weight="bold" aria-hidden /> : <HandWaving size={18} weight="fill" aria-hidden />}
              <span className="truncate">{meReady ? `Gotowy, czekamy na ${hostNick}` : `Jestem gotowy: ${def.name}`}</span>
            </button>
          ) : (
            <p className="flex min-h-12 w-full items-center justify-center text-center text-sm text-fg-muted">
              {def ? `Oglądasz. Czekamy, aż ${hostNick} zacznie` : `Czekamy, aż ${hostNick} wybierze grę`}
            </p>
          )}
        </StickyBar>
      )}
    </Screen>
  );
}

/** Szybkie gry to te, w które da się grać solo (minPlayers 1); reszta to planszowe i turowe. */
const GROUPS: [string, boolean][] = [
  ["Planszowe i turowe", false],
  ["Szybkie i refleksowe", true],
];

const ICONS: Record<string, Icon> = {
  "piec-w-rzedzie": GridNine,
  statki: Boat,
  chinczyk: DiceFive,
  "kampus-tour": Buildings,
  "panstwa-miasta": GlobeHemisphereEast,
  refleks: Lightning,
  simon: SquaresFour,
  stoper: Timer,
  schulte: NumberSquareOne,
  stroop: Palette,
  liczenie: Calculator,
  kolo: CircleDashed,
  kolor: Eyedropper,
  kropki: DotsNine,
};

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

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
      <button type="button" className="text-left" onClick={copy} aria-label={`Kod pokoju ${code}, kopiuj`}>
        <h2 className="label">{copied ? "Skopiowano!" : "Kod pokoju"}</h2>
        <p className="mt-1 font-mono text-6xl font-medium tracking-[0.12em]">{code}</p>
      </button>
      <button type="button" className="btn btn-ghost size-12 shrink-0 p-0" onClick={share} aria-label="Udostępnij link">
        {copied ? <Check size={20} weight="bold" aria-hidden /> : <ShareNetwork size={20} weight="bold" aria-hidden />}
      </button>
    </section>
  );
}
