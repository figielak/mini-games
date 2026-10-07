import {
  Bed,
  Bicycle,
  BookOpen,
  Bus,
  Cards,
  Coffee,
  Confetti,
  DiceFive,
  DiceFour,
  DiceOne,
  DiceSix,
  DiceThree,
  DiceTwo,
  Exam,
  Warning,
  ForkKnife,
  GraduationCap,
  Buildings,
  type Icon,
  Star,
  Printer,
  Sun,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import {
  KAMPUS_ALLOWANCE as ALLOWANCE,
  KAMPUS_BOARD as BOARD,
  KAMPUS_CARDS as CARDS,
  KAMPUS_GROUPS as GROUPS,
  KAMPUS_ROUNDS as ROUNDS,
  KAMPUS_UTILITY_RATES as UTILITY_RATES,
  type KampusEvent,
  type KampusMove,
  type KampusTourView,
  kampusBaseRent as baseRent,
  kampusBuildCost as buildCost,
  KAMPUS_LANDMARK as LANDMARK,
  KAMPUS_LEVEL_RENT as LEVEL_RENT,
  kampusMaxLevel as maxLevel,
  kampusSetOf as setOf,
  type GameResult,
  type LobbyPlayer,
} from "@mini-games/games";
import { type ReactNode, useEffect, useRef, useState } from "react";

interface Props {
  view: KampusTourView;
  me: string;
  players: LobbyPlayer[];
  dropped: boolean;
  canMove: boolean;
  /** Wynik partii (także walkower bez rankingu); null w trakcie gry. */
  result: GameResult | null;
  onMove: (move: KampusMove) => void;
  timer: ReactNode;
  actions: ReactNode;
}

const DICE = [DiceOne, DiceTwo, DiceThree, DiceFour, DiceFive, DiceSix];
/** Ikona gracza zależy od miejsca przy stole; ten sam kształt jest jego pionkiem. */
const SEAT_ICONS = [GraduationCap, BookOpen, Coffee, Bicycle];
/** Rogi ekranu w kolejności miejsc, zgodnie z ruchem wskazówek zegara. */
const SEAT_CORNERS = ["top-0 left-0", "top-0 right-0", "bottom-0 right-0", "bottom-0 left-0"];

/** Nagłówki grup, celowo inne niż kolory graczy (tło pola w kolorze gracza oznacza właściciela). */
const GROUP_COLORS = ["#a0785a", "#7cc4e6", "#d873b0", "#f0913c", "#e5484d", "#e8d44d", "#4caf7d", "#5b6fd6"];
const GROUP_NAMES = ["Rano", "Kampus", "Zajęcia", "Po zajęciach", "Na mieście", "Wieczór", "Spacer", "Noc w centrum"];
const UTILITY_COLOR = "#8b8b92";
const CARDS_COLOR = "#ff2445";

/** Krótkie podpisy na planszy; pełna nazwa jest w okienku po stuknięciu. */
const SHORT: Record<number, string> = {
  1: "Kawa",
  2: "Przekąski",
  3: "Biblioteka",
  4: "Hala PRz",
  6: "Rektorat",
  8: "Mechanik",
  9: "Elektryk",
  10: "Chemia",
  12: "Podpromie",
  14: "Stal",
  15: "Zalew",
  17: "3 Maja",
  18: "Galeria",
  19: "Millenium",
  20: "Kino",
  22: "Kręgielnia",
  23: "Klub",
  24: "Bulwary",
  25: "Kładka",
  26: "Pomnik",
  28: "Akademik",
  30: "Zamek",
  31: "Rynek",
};

/** Rogi: większe pola z własnym kolorem i opisem działania. */
/**
 * Rogi: neutralne tło (żeby nie myliły się z polami graczy i Dziekanatu), duża kolorowa ikona,
 * krótki podpis działania (przy Juwenaliach aktualny mnożnik).
 */
const CORNERS: Record<string, { icon: Icon; color: string; sub: string; info: string }> = {
  start: { icon: Sun, color: "#ffb224", sub: `+${ALLOWANCE} zł`, info: `Za każde przejście dostajesz ${ALLOWANCE} zł kieszonkowego.` },
  kolokwium: {
    icon: Exam,
    color: "#ff6369",
    sub: "tura lub dublet",
    info: "Trafiasz tu przez trzeci dublet z rzędu albo kartę Spóźnienie. W swojej turze rzucasz: dublet = zdajesz i od razu idziesz dalej, bez dubletu czekasz jedną turę. Karta Zaliczenie wyprowadza bez rzutu. Samo stanięcie tutaj nic nie robi.",
  },
  juwenalia: {
    icon: Confetti,
    color: "#e879f9",
    sub: "×2 czynsz",
    info: "Wybierasz jedno ze swoich pól: czynsz na nim rośnie. Pierwsze Juwenalia ×2, kolejne ×3, ×4 itd. Juwenalia są tylko na jednym polu naraz, nowe przenoszą je z poprzedniego.",
  },
  mpk: {
    icon: Bus,
    color: "#3dd68c",
    sub: "dowolne pole",
    info: "Tura się kończy, a w następnej zamiast rzutu możesz pojechać na dowolne pole (mijając Początek, dostajesz kieszonkowe). Zwykły rzut zużywa bilet.",
  },
};
const UTILITY_ICONS: Record<string, Icon> = { Ksero: Printer, Stołówka: ForkKnife };

const mix = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--color-bg))`;
const price = (tile: number) => {
  const t = BOARD[tile];
  return t.kind === "property" || t.kind === "utility" ? t.price : t.kind === "tax" ? t.amount : 0;
};
const levelName = (level: number) => (level === LANDMARK ? "landmark" : `poziom ${level}`);
const levelRent = (tile: number, level: number) => Math.round(LEVEL_RENT[level - 1] * price(tile));
/** „1 pole”, „3 pola”, „5 pól”. */
function fields(n: number) {
  if (n === 1) return "1 pole";
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `${n} ${few ? "pola" : "pól"}`;
}

/** Pochylenie planszy (2.5D): kąt, perspektywa i pomniejszenie, żeby bliższa krawędź nie wychodziła poza ekran. */
const TILT = 10;
const PERSPECTIVE = "1000px";
const TILT_SCALE = 0.95;
const BOARD_WIDTH = "min(100cqw, calc(100cqh * 13 / 7))";
/** Płaska nakładka na środek planszy: mniej więcej obszar wewnątrz pochylonego pierścienia pól. */
const CENTER_WIDTH = `calc(${BOARD_WIDTH} * 0.72)`;
const CENTER_HEIGHT = `calc(${BOARD_WIDTH} * 0.27)`;
const TILE_EDGE = "0 3px 0 rgb(0 0 0 / 0.45)";

/** Tempo animacji: krok pionka o jedno pole i czas turlania kostek. */
const STEP_MS = 220;
const ROLL_MS = 700;
const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Pozycje pionków do wyświetlenia: po rzucie pionek idzie pole po polu do pozycji z serwera.
 * Długie skoki (powrót po zerwanym połączeniu) i ograniczony ruch w systemie: bez animacji.
 */
/**
 * Scena gry o stałej wysokości STAGE_H (szerokość z proporcji ekranu, w granicach), skalowana do ekranu.
 * Dzięki temu tekst, kostki i panele rosną razem z planszą (monitor) i nie ucinają się na wąskim telefonie.
 * W pionie gra jest obrócona (.landscape), więc szerokość i wysokość ekranu się zamieniają.
 */
const STAGE_H = 390;
const STAGE_MIN_W = 800;
const STAGE_MAX_W = 1000;
function useStage() {
  const read = () => {
    const portrait = innerHeight > innerWidth;
    const vw = portrait ? innerHeight : innerWidth;
    const vh = portrait ? innerWidth : innerHeight;
    const width = Math.min(STAGE_MAX_W, Math.max(STAGE_MIN_W, (vw * STAGE_H) / vh));
    return { width, scale: Math.min(vw / width, vh / STAGE_H) };
  };
  const [stage, setStage] = useState(read);
  useEffect(() => {
    const update = () => setStage(read());
    addEventListener("resize", update);
    return () => removeEventListener("resize", update);
  }, []);
  return stage;
}

function useWalk(target: Record<string, number>, paused: boolean): Record<string, number> {
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (paused) return;
    const behind = Object.keys(target).filter((p) => shown[p] !== target[p]);
    if (behind.length === 0) return;
    const far = behind.some((p) => shown[p] === undefined || (target[p] - shown[p] + BOARD.length) % BOARD.length > 12);
    if (reducedMotion || far) return setShown(target);
    const t = setTimeout(() => {
      setShown((prev) => {
        const next = { ...prev };
        for (const p of behind) next[p] = (prev[p] + 1) % BOARD.length;
        return next;
      });
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [shown, target, paused]);
  return shown;
}

/** Czy kostki się właśnie turlają: przez chwilę po każdym rzucie (rzut zawsze przesuwa jakiś pionek). */
function useRolling(positions: Record<string, number>): boolean {
  const key = JSON.stringify(positions);
  const last = useRef(key);
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    if (reducedMotion) return;
    setRolling(true);
    const t = setTimeout(() => setRolling(false), ROLL_MS);
    return () => clearTimeout(t);
  }, [key]);
  return rolling;
}

/** Kostki: w trakcie turlania co chwilę losowe oczka i podskakiwanie, potem wynik z serwera. */
function Dice({ values, rolling }: { values: [number, number]; rolling: boolean }) {
  const [faces, setFaces] = useState(values);
  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(() => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 90);
    return () => clearInterval(id);
  }, [rolling]);
  const shown = rolling ? faces : values;
  return (
    <span className="flex gap-1" aria-label={rolling ? "Rzut kośćmi" : `Wyrzucono ${values[0]} i ${values[1]}`}>
      {shown.map((d, i) => {
        const Die = DICE[d - 1];
        return (
          <Die
            key={i}
            size={44}
            weight="fill"
            className={rolling ? "animate-[dice-tumble_0.3s_ease-in-out_infinite]" : ""}
            style={{ animationDelay: `${i * 80}ms` }}
            aria-hidden
          />
        );
      })}
    </span>
  );
}

/** Zmiany gotówki jako pływające kwoty (+8 zł, −8 zł) przy panelach graczy; znikają po animacji. */
function useFloats(ids: string[], cash: Record<string, number>) {
  const [floats, setFloats] = useState<{ key: number; player: string; amount: number }[]>([]);
  const prev = useRef(cash);
  const next = useRef(0);
  useEffect(() => {
    const before = prev.current;
    prev.current = cash;
    const added = ids.filter((p) => cash[p] !== before[p]).map((p) => ({ key: next.current++, player: p, amount: cash[p] - before[p] }));
    if (!added.length) return;
    setFloats((f) => [...f, ...added]);
    // Bez sprzątania w cleanupie: kolejna zmiana gotówki nie może zatrzymać usuwania poprzednich kwot.
    setTimeout(() => setFloats((f) => f.filter((x) => !added.includes(x))), 1700);
  }, [cash, ids]);
  return floats;
}

/** Gracz, który właśnie zebrał 2. pełną grupę (o krok od monopolu); dismiss chowa ostrzeżenie u tego gracza. */
function useMonopolyWarning(ids: string[], owners: Record<number, string>, monopoly: string | null) {
  const [player, setPlayer] = useState<string | null>(null);
  const key = JSON.stringify(owners);
  // null przy pierwszym renderze: po odświeżeniu strony stary stan nie wywołuje ostrzeżenia.
  const prev = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    const counts = Object.fromEntries(ids.map((p) => [p, GROUPS.filter((g) => g.every((i) => owners[i] === p)).length]));
    const before = prev.current;
    prev.current = counts;
    if (!before || monopoly) return;
    const warned = ids.find((p) => counts[p] === 2 && before[p] < 2);
    if (warned) setPlayer(warned);
  }, [key]);
  return { player, dismiss: () => setPlayer(null) };
}

/** Pole planszy 12×6 → [kolumna, wiersz], od lewego górnego rogu zgodnie z ruchem wskazówek zegara. */
function cell(i: number): [number, number] {
  if (i <= 11) return [i, 0];
  if (i <= 15) return [11, i - 11];
  if (i <= 27) return [27 - i, 5];
  return [0, 32 - i];
}

export function KampusTour({ view, me, players, dropped, canMove, result, onMove, timer, actions }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const stage = useStage();
  const rolling = useRolling(view.positions);
  // Pionek rusza dopiero, gdy kostki się zatrzymają.
  const shown = useWalk(view.positions, rolling);
  // Komunikaty i decyzje dopiero, gdy pionek dojdzie na pole, żeby nie zdradzać wyniku przed animacją.
  const settled = !rolling && view.players.every((p) => shown[p] === view.positions[p]);
  // Podczas animacji widać zdarzenia sprzed rzutu; nowe pojawiają się po dojściu pionka.
  const settledEvents = useRef(view.events);
  if (settled) settledEvents.current = view.events;
  // Gotówka i pola tak samo: zmieniają się dopiero po dojściu pionka.
  const settledCash = useRef(view.cash);
  const settledOwners = useRef(view.owners);
  if (settled) {
    settledCash.current = view.cash;
    settledOwners.current = view.owners;
  }
  const cash = settledCash.current;
  const floats = useFloats(view.players, cash);
  const warning = useMonopolyWarning(view.players, settledOwners.current, view.monopoly);
  const recent = settledEvents.current.slice(-2);
  // Świeżo zebrany komplet: jego pola chwilę pulsują w kolorze gracza.
  const lastEvent = settledEvents.current.at(-1);
  const fresh = lastEvent?.type === "set" ? setOf(lastEvent.tile!) : [];
  const complete = (i: number) => {
    const owner = view.owners[i];
    return !!owner && setOf(i).every((t) => view.owners[t] === owner);
  };
  const player = (id: string) => players.find((p) => p.id === id);
  const color = (id: string) => player(id)?.color ?? "#8b8b92";
  const nick = (id: string) => player(id)?.nick ?? "Gracz";
  const seat = (id: string) => view.players.indexOf(id);
  const over = result !== null;
  const ranking = result?.ranking ?? [];
  const selling = canMove && view.phase === "sell";
  /** Wybór pola na Juwenalia albo cel jazdy MPK: przycisk w okienku pola. */
  const festive = canMove && settled && view.phase === "juwenalia";
  const traveling = canMove && settled && view.phase === "roll" && view.mpk.includes(me);
  const nextFactor = view.festivals + 2;

  const status = over
    ? result.winner === me
      ? `Wygrywasz${view.monopoly ? " przez monopol" : ""}!`
      : result.winner
        ? `Wygrywa ${nick(result.winner)}${view.monopoly ? " (monopol)" : ""}`
        : "Koniec gry"
    : canMove
      ? "Twoja tura"
      : `Ruch: ${nick(view.turn!)}`;

  const describe = (e: KampusEvent) => {
    const who = nick(e.player);
    switch (e.type) {
      case "allowance":
        return `${who} dostaje ${e.amount} zł kieszonkowego`;
      case "buy":
        return `${who} kupuje ${BOARD[e.tile!].name} za ${e.amount} zł`;
      case "rent":
        return `${who} płaci ${e.amount} zł za ${BOARD[e.tile!].name} → ${nick(e.to!)}`;
      case "tax":
        return `${who} płaci ${e.amount} zł za akademik`;
      case "set":
        return `${who} ma komplet: ${setOf(e.tile!).map((t) => SHORT[t] ?? BOARD[t].name).join(" + ")}! ${
          BOARD[e.tile!].kind === "utility" ? `Czynsz: oczka × ${UTILITY_RATES[1]} zł` : "Czynsz ×2, można stawiać landmark"
        }`;
      case "build":
        return `${who} buduje ${BOARD[e.tile!].name}: ${levelName(e.level!)} za ${e.amount} zł`;
      case "card":
        return `${who} ciągnie kartę: ${CARDS[e.card!].title}`;
      case "kolokwium":
        return `${who} trafia na Kolokwium`;
      case "pass":
        return e.card === undefined ? `${who} zdaje Kolokwium dubletem` : `${who} zdaje dzięki Zaliczeniu`;
      case "fail":
        return `${who} oblewa i czeka turę`;
      case "skip":
        return `${who} pomija ${BOARD[e.tile!].name}`;
      case "sell":
        return `${who} sprzedaje ${BOARD[e.tile!].name} za ${e.amount} zł`;
      case "bankrupt":
        return `${who} bankrutuje`;
      case "juwenalia":
        return `${who} ogłasza Juwenalia: ${BOARD[e.tile!].name}, czynsz ×${e.amount}`;
      case "mpk":
        return `${who} ma Bilet MPK na następną turę`;
      case "travel":
        return `${who} jedzie MPK: ${BOARD[e.tile!].name}`;
      case "buyout":
        return `${who} wykupuje ${BOARD[e.tile!].name} od ${nick(e.to!)} za ${e.amount} zł`;
      case "monopoly":
        return `${who} ma 3 pełne grupy: monopol!`;
    }
  };

  const here = view.turn ? view.positions[view.turn] : 0;
  /** Pole, o którego kupnie właśnie się decyduje: świeci, reszta planszy przygasa. */
  const deciding = settled && !over && (view.phase === "buy" || view.phase === "build" || view.phase === "buyout") ? here : null;
  const level = (tile: number) => view.levels[tile] ?? 0;
  /** Sprzedaż bankowi: połowa ceny pola z budynkami. */
  const value = (tile: number) => price(tile) + buildCost(tile, 0, level(tile));
  const saleValue = (tile: number) => Math.floor(value(tile) / 2);
  /** Majątek jak w rankingu po ostatniej rundzie: gotówka + pola z budynkami. */
  const wealth = (id: string) =>
    cash[id] + Object.keys(settledOwners.current).map(Number).filter((i) => settledOwners.current[i] === id).reduce((sum, i) => sum + value(i), 0);
  /** Poziomy, które gracz na turze może teraz zbudować na swoim polu. */
  const buildChoices = () => {
    const from = level(here);
    const options: number[] = [];
    for (let l = from + 1; l <= maxLevel(view.owners, here); l++) if (buildCost(here, from, l) <= view.cash[view.turn!]) options.push(l);
    return options;
  };

  /** Co daje kupno: czynsz i ile pól z grupy gracz już ma. */
  function buyInfo(i: number) {
    const t = BOARD[i];
    const owns = (match: (j: number) => boolean) => BOARD.filter((_, j) => match(j) && view.owners[j] === view.turn).length;
    if (t.kind === "utility") {
      const utilities = BOARD.map((b, j) => (b.kind === "utility" ? j : -1)).filter((j) => j >= 0);
      return `Czynsz: oczka × ${UTILITY_RATES[0]} zł (z oboma × ${UTILITY_RATES[1]}) · masz ${owns((j) => utilities.includes(j))}/${utilities.length}`;
    }
    if (t.kind !== "property") return null;
    const group = BOARD.map((b, j) => (b.kind === "property" && b.group === t.group ? j : -1)).filter((j) => j >= 0);
    return `Czynsz: ${baseRent(t.price)} zł (cała grupa ${baseRent(t.price) * 2} zł) · ${GROUP_NAMES[t.group]}: masz ${owns((j) => group.includes(j))}/${group.length}`;
  }

  /** Żeton gracza: ikona w ciemnym kółku z jasną obwódką, widoczny na każdym kolorze pola. */
  const token = (p: string, size: number, first: boolean) => {
    const Pawn = SEAT_ICONS[seat(p)];
    return (
      <span
        key={p}
        className="grid shrink-0 place-items-center rounded-full border-2 border-white bg-bg shadow-[0_1px_3px_rgb(0_0_0/0.7)]"
        style={{ width: size, height: size, marginLeft: first ? 0 : -size * 0.45 }}
      >
        <Pawn size={size * 0.62} weight="fill" style={{ color: color(p) }} aria-label={nick(p)} />
      </span>
    );
  };
  /** Pionki na polu: rząd zachodzących na siebie żetonów; przy 3-4 graczach mniejsze, żeby zmieścić się w polu. */
  const tokens = (tile: number, size: number) => {
    const here = view.players.filter((p) => shown[p] === tile && !view.bankrupt.includes(p));
    const s = here.length > 2 ? Math.round(size * 0.75) : size;
    return (
      <span className="flex shrink-0 items-center justify-center" style={{ height: size }}>
        {here.map((p, i) => token(p, s, i === 0))}
      </span>
    );
  };

  /** Zawartość pola na planszy, zależnie od rodzaju. */
  function tileFace(i: number) {
    const tile = BOARD[i];
    const sellable = selling && view.owners[i] === me;

    if (tile.kind in CORNERS) {
      const corner = CORNERS[tile.kind];
      // Pionki stoją obok ikony, więc przy tłoku ikona maleje.
      const pawns = view.players.filter((p) => shown[p] === i && !view.bankrupt.includes(p)).length;
      return (
        <>
          <span className="flex items-center gap-1">
            <corner.icon size={pawns >= 3 ? 22 : pawns ? 28 : 36} weight="fill" style={{ color: corner.color }} aria-hidden />
            {pawns > 0 && tokens(i, 22)}
          </span>
          <span className="px-1 text-center text-[11px] leading-none font-semibold text-fg">{tile.name}</span>
          <span className="mt-0.5 px-1 text-center text-[10px] leading-none font-medium whitespace-nowrap text-fg/90">
            {tile.kind === "juwenalia" ? `×${nextFactor} czynsz` : corner.sub}
          </span>
        </>
      );
    }

    // Kolorowy nagłówek: grupa dla nieruchomości, ikona dla pól specjalnych.
    const header =
      tile.kind === "property" ? GROUP_COLORS[tile.group] : tile.kind === "karty" ? CARDS_COLOR : UTILITY_COLOR;
    const HeaderIcon = tile.kind === "utility" ? UTILITY_ICONS[tile.name] : tile.kind === "karty" ? Cards : tile.kind === "tax" ? Bed : null;
    const label = tile.kind === "karty" ? "Dziekanat" : (SHORT[i] ?? tile.name);
    const side = cell(i)[0] === 0 || cell(i)[0] === 11;
    const priceTag = (
      <span className="font-mono text-[12px] leading-none font-semibold text-fg">
        {tile.kind === "karty" ? "\u00a0" : `${sellable ? `+${saleValue(i)}` : price(i)} zł`}
      </span>
    );
    return (
      <>
        <span className="grid h-[18%] w-full shrink-0 place-items-center text-bg" style={{ backgroundColor: header }} aria-hidden>
          {HeaderIcon && <HeaderIcon size={10} weight="fill" />}
          {/* Zabudowa: kwadraciki za poziomy 1-3, budynek za landmark. */}
          {level(i) === LANDMARK ? (
            <Buildings size={11} weight="fill" aria-label="Landmark" />
          ) : (
            level(i) > 0 && (
              <span className="flex gap-[2px]" aria-label={`Poziom ${level(i)}`}>
                {Array.from({ length: level(i) }, (_, k) => (
                  <span key={k} className="size-[5px] rounded-[1px] bg-bg" />
                ))}
              </span>
            )
          )}
        </span>
        <span className="flex min-h-0 flex-1 items-center justify-center px-0.5 text-center text-[10px] leading-[1.1] text-fg">{label}</span>
        {/* Pionki nie zasłaniają nazwy: na górze i dole planszy stoją nad ceną, na bokach (niskie pola) obok niej. */}
        {side ? (
          <span className="mb-0.5 flex items-center gap-1">
            {priceTag}
            {tokens(i, 22)}
          </span>
        ) : (
          <>
            <span className="mb-0.5 flex">{tokens(i, 26)}</span>
            <span className="mb-1 flex">{priceTag}</span>
          </>
        )}
      </>
    );
  }

  /** Szczegóły pola w okienku: pełna nazwa, zasady, czynsze i właściciel. */
  function tileInfo(i: number) {
    const tile = BOARD[i];
    const owner = view.owners[i];
    const rows: [string, string][] = [];
    let text: string | null = null;
    let accent = UTILITY_COLOR;

    if (tile.kind === "property") {
      accent = GROUP_COLORS[tile.group];
      rows.push(
        ["Cena", `${tile.price} zł`],
        ["Czynsz", `${baseRent(tile.price)} zł (komplet ${baseRent(tile.price) * 2} zł)`],
        ...LEVEL_RENT.map((_, k): [string, string] => [
          k + 1 === LANDMARK ? "Landmark" : `Poziom ${k + 1}`,
          `${levelRent(i, k + 1)} zł (budowa ${buildCost(i, k, k + 1)} zł)`,
        ]),
        ["Zabudowa", level(i) ? levelName(level(i)) : "brak"],
      );
      if (view.juwenalia?.tile === i) rows.push(["Juwenalia", `czynsz ×${view.juwenalia.factor}`]);
      text = "Budujesz po staniu na swoim polu. Landmark tylko z kompletem grupy.";
    } else if (tile.kind === "utility") {
      rows.push(
        ["Cena", `${tile.price} zł`],
        ["Czynsz", `oczka × ${UTILITY_RATES[0]} zł`],
        ["Ksero i Stołówka", `oczka × ${UTILITY_RATES[1]} zł`],
      );
    } else if (tile.kind === "tax") {
      text = `Płacisz ${tile.amount} zł opłaty do banku.`;
    } else if (tile.kind === "karty") {
      accent = CARDS_COLOR;
      text = `Ciągniesz kartę z talii Dziekanatu: stypendia, opłaty, wycieczki po Rzeszowie i Kolokwium. W talii: ${view.deckSize} kart.`;
    } else {
      accent = CORNERS[tile.kind].color;
      text = CORNERS[tile.kind].info;
    }
    const sellable = selling && owner === me;

    return (
      <div
        className="absolute inset-x-0 top-1/2 z-10 flex max-h-[calc(100cqh-1rem)] -translate-y-1/2 flex-col gap-2 overflow-auto rounded-inset border border-line bg-surface p-3 shadow-[0_12px_32px_rgb(0_0_0/0.6)]"
        style={{ borderTop: `6px solid ${accent}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">{tile.name}</h2>
            {tile.kind === "property" && <p className="text-xs text-fg-muted">{GROUP_NAMES[tile.group]}</p>}
          </div>
          <button type="button" className="-m-1 p-1 text-fg-muted" aria-label="Zamknij" onClick={() => setSelected(null)}>
            <X size={18} />
          </button>
        </div>
        {text && <p className="text-sm">{text}</p>}
        {rows.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-fg-muted">{k}</dt>
                <dd className="font-mono">{v}</dd>
              </div>
            ))}
            <dt className="text-fg-muted">Właściciel</dt>
            <dd>{owner ? `${nick(owner)}${owner === me ? " (ty)" : ""}` : "wolne"}</dd>
          </dl>
        )}
        {sellable && (
          <button
            type="button"
            className="btn btn-primary self-start"
            onClick={() => {
              onMove({ type: "sell", tile: i });
              setSelected(null);
            }}
          >
            Sprzedaj za {saleValue(i)} zł
          </button>
        )}
        {festive && owner === me && (
          <button
            type="button"
            className="btn btn-primary self-start"
            onClick={() => {
              onMove({ type: "juwenalia", tile: i });
              setSelected(null);
            }}
          >
            Juwenalia tutaj (×{nextFactor})
          </button>
        )}
        {traveling && i !== view.positions[me] && (
          <button
            type="button"
            className="btn btn-primary self-start"
            onClick={() => {
              onMove({ type: "travel", tile: i });
              setSelected(null);
            }}
          >
            Jedź tutaj MPK
          </button>
        )}
      </div>
    );
  }

  return (
    <main className="landscape grid place-items-center overflow-hidden">
      <div
        className="relative flex items-center justify-center p-2 px-21"
        style={{ width: stage.width, height: STAGE_H, zoom: stage.scale }}
      >
        {view.players.map((id, i) => {
          const Pawn = SEAT_ICONS[i];
          const active = !over && view.turn === id;
          const out = view.bankrupt.includes(id);
          return (
            <div
              key={id}
              className={`absolute flex w-20 flex-col items-center gap-0.5 rounded-inset border-2 p-1.5 text-center text-xs ${SEAT_CORNERS[i]} ${
                active ? "" : "border-transparent text-fg-muted"
              } ${out ? "opacity-40" : ""}`}
              // Gracz na turze: obwódka, tło i poświata w jego kolorze.
              style={active ? { borderColor: color(id), backgroundColor: mix(color(id), 16), boxShadow: `0 0 14px ${mix(color(id), 55)}` } : undefined}
            >
              <Pawn size={26} weight="fill" style={{ color: color(id) }} aria-hidden />
              <span className={`w-full truncate ${out ? "line-through" : ""}`}>
                {nick(id)}
                {id === me && " (ty)"}
              </span>
              <span className="font-mono text-sm text-fg">{out ? "bankrut" : `${cash[id]} zł`}</span>
              {!out && (
                <span title="Majątek: gotówka + pola z budynkami">
                  majątek <span className="font-mono text-fg">{wealth(id)}</span>
                </span>
              )}
              {!out && <span>{fields(Object.values(view.owners).filter((o) => o === id).length)}</span>}
              {view.kolokwium.includes(id) && <span className="font-medium text-[#ff6369]">na Kolokwium</span>}
              {(view.passes[id] ?? 0) > 0 && <span className="text-fg">Zaliczenie ×{view.passes[id]}</span>}
              {view.mpk.includes(id) && <span className="font-medium text-[#3dd68c]">Bilet MPK</span>}
              {ranking.includes(id) && <span className="font-mono">{ranking.indexOf(id) + 1}. miejsce</span>}
              {floats
                .filter((f) => f.player === id)
                .map((f) => (
                  <span
                    key={f.key}
                    className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 animate-[float-up_1.6s_ease-out_forwards] font-mono text-base font-bold whitespace-nowrap drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]"
                    style={{ color: f.amount > 0 ? "#3dd68c" : "#ff6369" }}
                    aria-hidden
                  >
                    {f.amount > 0 ? "+" : "−"}
                    {Math.abs(f.amount)} zł
                  </span>
                ))}
            </div>
          );
        })}

        {/* Plansza 13:7 (rogi 1,5 raza większe) możliwie duża w dostępnym miejscu (jednostki kontenera), lekko pochylona. */}
        <div className="relative grid h-full w-full place-items-center" style={{ containerType: "size", perspective: PERSPECTIVE }}>
          <div
            className="grid gap-[3px] rounded-md p-[3px]"
            style={{
              width: BOARD_WIDTH,
              aspectRatio: "13 / 7",
              gridTemplateColumns: "1.5fr repeat(10, 1fr) 1.5fr",
              gridTemplateRows: "1.5fr repeat(4, 1fr) 1.5fr",
              transform: `rotateX(${TILT}deg) scale(${TILT_SCALE})`,
              // Podstawa planszy: krawędź od spodu i cień na „stole”.
              backgroundColor: "color-mix(in srgb, var(--color-fg) 6%, var(--color-bg))",
              boxShadow: "0 10px 0 color-mix(in srgb, var(--color-fg) 3%, var(--color-bg)), 0 28px 40px rgb(0 0 0 / 0.6)",
            }}
          >
            {BOARD.map((tile, i) => {
              const [x, y] = cell(i);
              const owner = view.owners[i];
              const sellable = (selling || festive) && owner === me;
              const background =
                tile.kind in CORNERS
                ? "color-mix(in srgb, var(--color-fg) 17%, var(--color-bg))"
                : tile.kind === "karty"
                  ? mix(CARDS_COLOR, 14)
                  : owner
                    ? mix(color(owner), complete(i) ? 45 : 25)
                    : undefined;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={tile.name}
                  aria-pressed={selected === i}
                  className={`relative flex flex-col items-center justify-center overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--color-fg)_12%,var(--color-bg))] transition-opacity ${
                    sellable ? "z-10 outline-2 outline-accent" : deciding === i ? "z-10 outline-2" : selected === i ? "outline-2 outline-fg" : ""
                  } ${deciding !== null && deciding !== i ? "opacity-35" : ""} ${fresh.includes(i) ? "animate-[set-glow_0.9s_ease-in-out_4]" : ""}`}
                  style={{
                    gridColumn: x + 1,
                    gridRow: y + 1,
                    backgroundColor: background,
                    ["--glow" as string]: owner ? color(owner) : undefined,
                    // Grubość pola (krawędź od spodu); poświata tylko dla pola, na którym dzieje się akcja.
                    // Pole decyzji świeci kolorem gracza, który decyduje (czerwień kojarzy się z Dziekanatem i długiem).
                    outlineColor: deciding === i ? color(view.turn!) : undefined,
                    boxShadow: deciding === i ? `${TILE_EDGE}, 0 0 16px ${color(view.turn!)}` : TILE_EDGE,
                  }}
                  onClick={() => setSelected(selected === i ? null : i)}
                >
                  {tileFace(i)}
                  {view.juwenalia?.tile === i && (
                    <span
                      className="absolute top-0 left-0 flex items-center rounded-br-sm bg-bg/80 px-0.5 font-mono text-[10px] leading-none font-semibold"
                      style={{ color: CORNERS.juwenalia.color }}
                      aria-label={`Juwenalia: czynsz ×${view.juwenalia.factor}`}
                    >
                      <Confetti size={11} weight="fill" aria-hidden />×{view.juwenalia.factor}
                    </span>
                  )}
                  {/* Właściciel: stała kropka w jego kolorze w rogu pola (i lekki odcień tła); przy komplecie gwiazdka. */}
                  {owner &&
                    (complete(i) ? (
                      <Star
                        size={16}
                        weight="fill"
                        className="absolute top-0 right-0 drop-shadow-[0_0_1.5px_var(--color-bg)]"
                        style={{ color: color(owner) }}
                        aria-label={`Komplet: ${nick(owner)}`}
                      />
                    ) : (
                      <span
                        className="absolute top-0.5 right-0.5 size-3 rounded-full border-2 border-bg"
                        style={{ backgroundColor: color(owner) }}
                        aria-label={`Właściciel: ${nick(owner)}`}
                      />
                    ))}
                </button>
              );
            })}

            {/* Środek planszy pusty: treść leży w płaskiej nakładce poniżej, żeby tekst i przyciski nie były pochylone. */}
            <div style={{ gridColumn: "2 / 12", gridRow: "2 / 6" }} />
          </div>

          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="pointer-events-auto relative" style={{ width: CENTER_WIDTH, height: CENTER_HEIGHT }}>
              <div className="flex h-full flex-col items-center justify-center gap-1.5 overflow-hidden p-2">
                <div className="flex w-full max-w-sm items-center gap-3">
                  <span className="label shrink-0">
                    Runda {view.round}/{ROUNDS}
                  </span>
                  {timer && <div className="flex-1">{timer}</div>}
                </div>
                <h1 className="text-lg font-semibold">{status}</h1>
                {dropped && (
                  <p role="status" className="flex items-center gap-2 text-sm text-accent">
                    <WifiSlash size={16} aria-hidden />
                    Łączenie ponownie…
                  </p>
                )}
                {recent.length > 0 && (
                  <ul className="text-center text-sm font-medium">
                    {recent.map((e, i) => (
                      <li
                        key={i}
                        className={e.type === "set" ? "font-semibold" : i === recent.length - 1 ? "text-fg" : "text-fg-muted"}
                        style={e.type === "set" ? { color: color(e.player) } : undefined}
                      >
                        {describe(e)}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-3">
                  {/* Przy budowie kostki ustępują miejsca przyciskom poziomów. */}
                  {view.dice && !over && !(settled && canMove && view.phase === "build") && <Dice values={view.dice} rolling={rolling} />}
                  {settled && canMove && view.phase === "roll" && (
                    <button type="button" className="btn btn-primary" onClick={() => onMove({ type: "roll" })}>
                      {!view.kolokwium.includes(me)
                        ? "Rzuć kośćmi"
                        : (view.passes[me] ?? 0) > 0
                          ? "Rzuć (użyjesz Zaliczenia)"
                          : "Rzuć (potrzebny dublet)"}
                    </button>
                  )}
                  {settled && canMove && view.phase === "buy" && (
                    <>
                      <button type="button" className="btn btn-primary" onClick={() => onMove({ type: "buy" })}>
                        Kup {SHORT[here] ?? BOARD[here].name} za {price(here)} zł
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => onMove({ type: "skip" })}>
                        Pomiń
                      </button>
                    </>
                  )}
                  {settled && !over && !canMove && view.phase === "roll" && <p className="text-sm text-fg-muted">{nick(view.turn!)} rzuca kośćmi…</p>}
                  {settled && canMove && view.phase === "build" && (
                    <>
                      {buildChoices().map((l) => (
                        <button
                          key={l}
                          type="button"
                          className="btn btn-primary min-h-11 flex-col gap-0 px-3 text-sm leading-tight"
                          onClick={() => onMove({ type: "build", level: l })}
                        >
                          {l === LANDMARK ? "Landmark" : `Poziom ${l}`}
                          <span className="text-[11px] font-normal">
                            {buildCost(here, level(here), l)} zł · czynsz {levelRent(here, l)}
                          </span>
                        </button>
                      ))}
                      <button type="button" className="btn btn-ghost min-h-11 px-4" onClick={() => onMove({ type: "skip" })}>
                        Pomiń
                      </button>
                    </>
                  )}
                  {settled && canMove && view.phase === "buyout" && (
                    <>
                      <button type="button" className="btn btn-primary" onClick={() => onMove({ type: "buyout" })}>
                        Wykup {SHORT[here] ?? BOARD[here].name} za {2 * value(here)} zł
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => onMove({ type: "skip" })}>
                        Pomiń
                      </button>
                    </>
                  )}
                  {settled && !over && !canMove && view.phase === "buy" && <p className="text-sm text-fg-muted">{nick(view.turn!)} decyduje o zakupie</p>}
                  {settled && !over && !canMove && view.phase === "buyout" && <p className="text-sm text-fg-muted">{nick(view.turn!)} decyduje o wykupie</p>}
                  {settled && !over && view.phase === "juwenalia" && (
                    <p className="text-center text-sm">
                      {canMove
                        ? `Juwenalia! Stuknij swoje pole: czynsz ×${nextFactor}`
                        : `${nick(view.turn!)} wybiera pole na Juwenalia (×${nextFactor})`}
                    </p>
                  )}
                  {settled && !over && !canMove && view.phase === "build" && <p className="text-sm text-fg-muted">{nick(view.turn!)} decyduje o budowie</p>}
                </div>
                {settled && canMove && view.phase === "buy" && <p className="text-center text-sm text-fg-muted">{buyInfo(here)}</p>}
                {settled && canMove && view.phase === "buyout" && (
                  <p className="text-center text-sm text-fg-muted">
                    2× wartość pola · pieniądze dostaje {nick(view.owners[here])}
                  </p>
                )}
                {traveling && <p className="text-center text-sm text-fg-muted">Masz Bilet MPK: stuknij dowolne pole i jedź albo rzuć kośćmi</p>}
                {settled && canMove && view.phase === "build" && (
                  <p className="text-center text-sm text-fg-muted">
                    Budujesz: {BOARD[here].name}
                    {maxLevel(view.owners, here) < LANDMARK && " · landmark po zebraniu kompletu"}
                  </p>
                )}

                {!over && view.phase === "sell" && view.debt && (
                  <p className="text-center text-sm">
                    {selling
                      ? `Brakuje ${view.debt.amount - view.cash[me]} zł. Stuknij swoje pole i sprzedaj je za pół ceny.`
                      : `${nick(view.turn!)} sprzedaje pola, żeby spłacić ${view.debt.amount} zł`}
                  </p>
                )}
                {actions && <div className="flex w-full max-w-xs gap-2">{actions}</div>}
              </div>

              {selected !== null && tileInfo(selected)}
            </div>
          </div>
        </div>

        {/* Karta Dziekanatu: plansza się rozmywa, karta na środku, efekt dopiero po kliknięciu. */}
        {settled && !over && view.phase === "card" && view.card !== null && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-bg/60 backdrop-blur-sm">
            <div
              role="dialog"
              aria-label="Karta Dziekanatu"
              className="flex w-72 animate-[card-in_0.35s_ease-out] flex-col overflow-hidden rounded-inset border border-line bg-surface shadow-[0_16px_48px_rgb(0_0_0/0.7)]"
            >
              <div className="flex items-center gap-2 px-4 py-2.5 text-bg" style={{ backgroundColor: CARDS_COLOR }}>
                <Cards size={22} weight="fill" aria-hidden />
                <span className="text-xs font-semibold tracking-wide uppercase">Karta Dziekanatu · {nick(view.turn!)}</span>
              </div>
              <div className="flex flex-col gap-2 p-4 text-center">
                <h2 className="text-lg font-semibold">{CARDS[view.card].title}</h2>
                <p className="text-sm text-fg-muted">{CARDS[view.card].text}</p>
                {canMove ? (
                  <button type="button" className="btn btn-primary mt-2" autoFocus onClick={() => onMove({ type: "card" })}>
                    OK
                  </button>
                ) : (
                  <p className="mt-2 text-sm text-fg-muted">{nick(view.turn!)} czyta kartę…</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ostrzeżenie: ktoś ma 2 pełne grupy, trzecia to monopol i koniec gry. */}
        {warning.player && !over && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-bg/60 backdrop-blur-sm">
            <div
              role="alertdialog"
              aria-label="Groźba monopolu"
              className="flex w-80 animate-[card-in_0.35s_ease-out] flex-col overflow-hidden rounded-inset border border-line bg-surface shadow-[0_16px_48px_rgb(0_0_0/0.7)]"
            >
              <div className="flex items-center gap-2 px-4 py-2.5 text-bg" style={{ backgroundColor: color(warning.player) }}>
                <Warning size={22} weight="fill" aria-hidden />
                <span className="text-xs font-semibold tracking-wide uppercase">Groźba monopolu</span>
              </div>
              <div className="flex flex-col gap-2 p-4 text-center">
                <h2 className="text-lg font-semibold">
                  {warning.player === me ? "Masz 2 pełne grupy!" : `${nick(warning.player)} ma 2 pełne grupy!`}
                </h2>
                <p className="text-sm text-fg-muted">
                  {warning.player === me ? "Jeszcze jedna i wygrywasz przez monopol." : "Jeszcze jedna i wygrywa przez monopol. Nie oddawaj pól z grup, które zaczął zbierać."}
                </p>
                {/* Grupy, które zaczął zbierać: ile pól już ma. */}
                <ul className="flex flex-wrap justify-center gap-1.5 text-xs">
                  {GROUPS.map((g, k) => ({ k, mine: g.filter((i) => view.owners[i] === warning.player).length, total: g.length }))
                    .filter(({ mine, total }) => mine > 0 && mine < total)
                    .map(({ k, mine, total }) => (
                      <li key={k} className="rounded-full border px-2 py-0.5" style={{ borderColor: GROUP_COLORS[k] }}>
                        {GROUP_NAMES[k]} {mine}/{total}
                      </li>
                    ))}
                </ul>
                <button type="button" className="btn btn-primary mt-2" autoFocus onClick={warning.dismiss}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
