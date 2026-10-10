import {
  Angle,
  ArrowsClockwise,
  Boat,
  Buildings,
  CalendarBlank,
  Calculator,
  Cards,
  Check,
  CircleDashed,
  CirclesThree,
  Crown,
  DiceFive,
  DotsNine,
  Eyedropper,
  GlobeHemisphereEast,
  GridNine,
  HandPalm,
  HandWaving,
  type Icon,
  Lightning,
  LineSegment,
  MagnifyingGlass,
  MapTrifold,
  Metronome,
  NumberSquareOne,
  Palette,
  Play,
  ShareNetwork,
  SignOut,
  SquaresFour,
  Stack,
  Timer,
} from "@phosphor-icons/react";
import { GAMES, type LobbyPlayer, MAX_PLAYERS, PLAYER_COLORS, type RoomView } from "@mini-games/games";
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
  if (!view) {
    return (
      <Screen dropped={dropped}>
        <div className="tile h-36 animate-pulse" aria-label="Wczytywanie" />
        <div className="tile h-24 animate-pulse" />
      </Screen>
    );
  }
  const isHost = view.hostId === me;
  const def = view.gameId ? GAMES[view.gameId] : undefined;
  const DefIcon = (def && ICONS[def.id]) || Play;

  return (
    <Screen dropped={dropped}>
      <Code code={view.code} onLeave={onLeave} />
      <Players view={view} me={me} send={send} />

      {/* Gospodarz: siatka gier. Gra główna otwiera ekran gry (Setup.tsx), mini-gra startuje stąd. */}
      {isHost &&
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
                      disabled={tooMany}
                      className={`flex min-h-20 flex-col items-start gap-1 rounded-inset border p-3 text-left transition-colors ${
                        picked ? "border-accent bg-accent-soft" : "border-line enabled:hover:border-line-hover"
                      } ${tooMany ? "opacity-40" : ""}`}
                      onClick={() => send("pickGame", { gameId: g.id })}
                    >
                      <Icon size={22} weight={picked ? "fill" : "regular"} aria-hidden />
                      <span className="leading-tight">{g.name}</span>
                      <span className="font-mono text-xs text-fg-muted">
                        {tooMany ? (g.minPlayers === g.maxPlayers ? "tylko " : "max ") + `${g.maxPlayers} os.` : seats(g)}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}

      {/* Gość: jedna karta na całą szerokość z opisem wybranej mini-gry. */}
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

      <StartBar view={view} me={me} send={send} />
    </Screen>
  );
}

/** Lista graczy z miejscami, gotowością i wyborem koloru; wspólna dla lobby i ekranu gry. */
export function Players({ view, me, send }: { view: RoomView; me: string; send: Send }) {
  const isHost = view.hostId === me;
  const def = view.gameId ? GAMES[view.gameId] : undefined;
  return (
    <section className="tile">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="label">Gracze</h2>
        <span className="font-mono text-sm text-fg-muted">
          W pokoju {view.players.length}/{MAX_PLAYERS}
        </span>
      </div>
      {(
        (def
          ? [
              [`Grają ${view.seats.length}/${def.maxPlayers} (limit gry)`, view.seats.map((id) => view.players.find((p) => p.id === id)!)],
              ["Oglądają", view.players.filter((p) => !view.seats.includes(p.id))],
            ]
          : [["", view.players]]
        ) as [string, LobbyPlayer[]][]
      )
        .filter(([, players]) => players.length > 0)
        .map(([title, players]) => (
          <div key={title} className="mt-2 first:mt-0">
            {title && <h3 className="mb-1 px-1 text-sm text-fg-muted">{title}</h3>}
            <ul className="flex flex-col gap-1">
              {players.map((p) => {
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
                        seated &&
                        (p.ready || p.id === view.hostId ? (
                          <span className="flex items-center gap-1 text-fg">
                            <Check size={14} weight="bold" aria-hidden />
                            gotowe
                          </span>
                        ) : (
                          "czeka"
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
          </div>
        ))}
      <ColorPicker view={view} me={me} send={send} />
      {view.players.length === 1 && (
        <p className="mt-3 text-sm text-fg-muted">Podaj znajomym kod pokoju, żeby dołączyli.</p>
      )}
      {isHost && def && view.players.length > 1 && (
        <p className="mt-3 text-sm text-fg-muted">Dotknij gracza, żeby przenieść go między grającymi a oglądającymi.</p>
      )}
    </section>
  );
}

/** Dolny pasek: start u gospodarza, gotowość u gościa z miejscem, informacja u oglądających. */
export function StartBar({ view, me, send }: { view: RoomView; me: string; send: Send }) {
  const isHost = view.hostId === me;
  const def = view.gameId ? GAMES[view.gameId] : undefined;
  const hostNick = view.players.find((p) => p.id === view.hostId)?.nick ?? "gospodarz";
  const guests = view.seats.filter((id) => id !== view.hostId);
  const unready = view.players.filter((p) => guests.includes(p.id) && !p.ready);
  const meSeated = view.seats.includes(me);
  const meReady = !!view.players.find((p) => p.id === me)?.ready;
  const startBlocker = !def
    ? "Wybierz grę"
    : view.seats.length < def.minPlayers
      ? `Zaznacz ${def.minPlayers} graczy do gry`
      : unready.length === 1
        ? `Czekamy na: ${unready[0].nick}`
        : unready.length > 1
          ? `Czekamy na gotowość (${guests.length - unready.length}/${guests.length})`
          : null;

  return (
    <StickyBar>
      {isHost ? (
        <button type="button" className={`btn w-full ${startBlocker ? "btn-ghost" : "btn-primary"}`} disabled={!!startBlocker} onClick={() => send("start")}>
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
          <span className="truncate">{meReady ? `Gotowe, czekamy na ${hostNick}` : `Zgłaszam gotowość: ${def.name}`}</span>
        </button>
      ) : (
        <p className="flex min-h-12 w-full items-center justify-center text-center text-sm text-fg-muted">
          {def ? `Oglądasz. Czekamy, aż ${hostNick} zacznie` : `Czekamy, aż ${hostNick} wybierze grę`}
        </p>
      )}
    </StickyBar>
  );
}

/** Szybkie gry to te, w które da się grać solo (minPlayers 1); reszta to planszowe i turowe. */
const GROUPS: [string, boolean][] = [
  ["Planszowe i turowe", false],
  ["Szybkie i refleksowe", true],
];

export const ICONS: Record<string, Icon> = {
  "piec-w-rzedzie": GridNine,
  statki: Boat,
  chinczyk: DiceFive,
  memory: Cards,
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
  rok: CalendarBlank,
  srodek: LineSegment,
  stoj: HandPalm,
  sledzenie: CirclesThree,
  wieza: Stack,
  rytm: Metronome,
  inny: MagnifyingGlass,
  obrot: ArrowsClockwise,
  mapa: MapTrifold,
  kat: Angle,
};

export function seats(g: { minPlayers: number; maxPlayers: number }) {
  return g.minPlayers === g.maxPlayers ? `${g.minPlayers} os.` : `${g.minPlayers}-${g.maxPlayers} os.`;
}

/** Jedno zdanie o grze dla gościa, zanim zgłosi gotowość. */
export const BLURBS: Record<string, string> = {
  "piec-w-rzedzie": "Na zmianę stawiacie kamienie na planszy 15×15. Wygrywa pięć lub więcej w linii.",
  statki: "Rozstawiasz flotę, potem strzelacie na zmianę. Trafienie daje kolejny strzał, wygrywa ten, kto zatopi wszystko.",
  chinczyk: "Rzucasz kostką i prowadzisz pionki dookoła planszy do domku. Stając na pionku rywala, odsyłasz go na start.",
  memory: "Na zmianę odkrywacie po dwie karty. Para zostaje u ciebie i daje kolejny ruch, wygrywa najwięcej par.",
  "kampus-tour": "Planszówka ekonomiczna: rzut dwiema kośćmi, kupujesz pola kampusu, rozbudowujesz je i zbierasz czynsz. Wygrywa ostatni wypłacalny albo najbogatszy po 20 rundach.",
  "panstwa-miasta": "5 rund, każda na inną literę i 6 kategorii. Kto pierwszy odda kartkę, daje STOP, potem głosujecie nad odpowiedziami.",
  refleks: "Dotknij pola, gdy zmieni kolor. 30 s, liczy się liczba trafień, falstart kosztuje czas.",
  simon: "Powtarzasz coraz dłuższą sekwencję 4 kolorów. Liczy się najdłuższa seria.",
  stoper: "Licznik znika po 3 s. Dotknij dokładnie w wylosowanej sekundzie, wygrywa najmniejsza odchyłka.",
  schulte: "Siatka 5×5 z liczbami 1-25, dotykasz po kolei. Liczy się czas, pomyłka dodaje 3 s.",
  stroop: "Nazwa koloru napisana innym kolorem. Wybierasz kolor liter, nie słowo. 30 s.",
  liczenie: "30 s szybkich działań z czterema odpowiedziami. Pomyłka blokuje na sekundę.",
  kolo: "Rysujesz palcem koło, do 10 prób. Liczy się najlepsza, wynik to procent idealności.",
  kolor: "Widzisz kolor przez 2 s, potem odtwarzasz go suwakami. 5 kolorów, wygrywa najmniejszy błąd.",
  kropki: "Kropki migają przez 1,5 s, wpisujesz, ile ich było. 10 rund, wygrywa najmniejsza suma błędów.",
  rok: "Widzisz wydarzenie, ustawiasz jego rok suwakiem. 10 rund, wygrywa najmniejsza suma odchyłek.",
  srodek: "Odcinek pod losowym kątem, dotykasz dokładnie jego środka. 10 rund, wygrywa najmniejsza suma błędów.",
  stoj: "Zielone pole dotykasz, czerwonego nie wolno. 30 s, tempo rośnie, błąd zabiera 2 punkty.",
  sledzenie: "Kulki lecą po polu, trzy z nich są celami. Widzisz je krótko, potem śledzisz ruch i wskazujesz te trzy.",
  rytm: "Metronom gra 8 uderzeń i cichnie, a ty stukasz dalej w tym samym tempie przez 10 s. Wygrywa najmniejsza odchyłka.",
  inny: "Siatka identycznych symboli, jeden różni się obrotem, odcieniem, rozmiarem albo kształtem. 30 s, siatka rośnie po każdym trafieniu.",
  obrot: "Dwie figury z klocków: ta sama obrócona czy lustrzane odbicie? 30 s, pomyłka zabiera punkt.",
  mapa: "Nazwa miasta, wskazujesz je na konturze Polski. 10 rund, wygrywa najmniejsza suma kilometrów.",
  kat: "Kąt miga przez 1,5 s, wpisujesz jego miarę w stopniach. 10 rund, wygrywa najmniejsza suma błędów.",
  wieza: "Klocek jeździ w poziomie, zatrzymujesz go nad poprzednim. To, co wystaje, zostaje ucięte. Liczy się wysokość wieży.",
};

/** Nazwy kolorów z PLAYER_COLORS (ta sama kolejność), dla czytników ekranu. */
const COLOR_NAMES = ["niebieski", "żółty", "zielony", "fioletowy", "morski", "różowy"];

/** Wybór własnego koloru: zajęte przez innych są przygaszone, nieaktywne i podpisane inicjałem właściciela. */
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
              className="grid size-10 place-items-center rounded-full"
              onClick={() => send("pickColor", { color })}
            >
              <span
                className={`grid size-7 place-items-center rounded-full font-mono text-xs text-fg-muted ${color === mine ? "outline-2 outline-offset-2 outline-fg" : ""}`}
                style={{ backgroundColor: taken ? `color-mix(in srgb, ${color} 25%, transparent)` : color }}
              >
                {color === mine && <Check size={14} weight="bold" className="text-bg" aria-hidden />}
                {taken && <span aria-hidden>{owner.nick.charAt(0).toUpperCase()}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Code({ code, onLeave }: { code: string; onLeave: () => void }) {
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
    <section className="tile">
      <div className="flex items-center justify-between">
        <h2 className="label">{copied ? "Skopiowano!" : "Kod pokoju"}</h2>
        <button type="button" className="-m-2 flex items-center gap-1.5 p-2 text-sm text-fg-muted" onClick={onLeave}>
          <SignOut size={16} aria-hidden />
          Wyjdź
        </button>
      </div>
      <div className="mt-1 flex items-end justify-between gap-4">
        <button type="button" className="text-left" onClick={copy} aria-label={`Kod pokoju ${code}, kopiuj`}>
          <span className="font-mono text-6xl font-medium tracking-[0.12em]">{code}</span>
        </button>
        <button type="button" className="btn btn-ghost size-12 shrink-0 p-0" onClick={share} aria-label="Udostępnij link">
          {copied ? <Check size={20} weight="bold" aria-hidden /> : <ShareNetwork size={20} weight="bold" aria-hidden />}
        </button>
      </div>
    </section>
  );
}
