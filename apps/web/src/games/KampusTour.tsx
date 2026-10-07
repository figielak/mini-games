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
  ForkKnife,
  GraduationCap,
  type Icon,
  Printer,
  Sun,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import {
  KAMPUS_ALLOWANCE as ALLOWANCE,
  KAMPUS_BOARD as BOARD,
  KAMPUS_ROUNDS as ROUNDS,
  KAMPUS_UTILITY_RATES as UTILITY_RATES,
  type KampusEvent,
  type KampusMove,
  type KampusTourView,
  kampusBaseRent as baseRent,
  type LobbyPlayer,
} from "@mini-games/games";
import { type ReactNode, useState } from "react";

interface Props {
  view: KampusTourView;
  me: string;
  players: LobbyPlayer[];
  dropped: boolean;
  canMove: boolean;
  /** Kolejność końcowa z wyniku gry; pusta w trakcie partii. */
  ranking: string[];
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
const CORNERS: Record<string, { icon: Icon; color: string; info: string }> = {
  start: { icon: Sun, color: "#46a758", info: `Za każde przejście dostajesz ${ALLOWANCE} zł kieszonkowego.` },
  kolokwium: { icon: Exam, color: "#e5484d", info: "Wkrótce: tracisz turę albo zdajesz, rzucając dublet. Na razie bez efektu." },
  juwenalia: { icon: Confetti, color: "#d873b0", info: "Wkrótce: wybierasz swoje pole, które ma podwójny czynsz. Na razie bez efektu." },
  mpk: { icon: Bus, color: "#ffc53d", info: "Wkrótce: w następnej turze przeskakujesz na dowolne pole. Na razie bez efektu." },
};
const UTILITY_ICONS: Record<string, Icon> = { Ksero: Printer, Stołówka: ForkKnife };

const mix = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--color-bg))`;
const price = (tile: number) => {
  const t = BOARD[tile];
  return t.kind === "property" || t.kind === "utility" ? t.price : t.kind === "tax" ? t.amount : 0;
};
const saleValue = (tile: number) => Math.floor(price(tile) / 2);

/** Pole planszy 12×6 → [kolumna, wiersz], od lewego górnego rogu zgodnie z ruchem wskazówek zegara. */
function cell(i: number): [number, number] {
  if (i <= 11) return [i, 0];
  if (i <= 15) return [11, i - 11];
  if (i <= 27) return [27 - i, 5];
  return [0, 32 - i];
}

export function KampusTour({ view, me, players, dropped, canMove, ranking, onMove, timer, actions }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const player = (id: string) => players.find((p) => p.id === id);
  const color = (id: string) => player(id)?.color ?? "#8b8b92";
  const nick = (id: string) => player(id)?.nick ?? "Gracz";
  const seat = (id: string) => view.players.indexOf(id);
  const over = view.phase === "over";
  const selling = canMove && view.phase === "sell";

  const status = over
    ? ranking[0] === me
      ? "Wygrywasz!"
      : `Wygrywa ${nick(ranking[0])}`
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
      case "sell":
        return `${who} sprzedaje ${BOARD[e.tile!].name} za ${e.amount} zł`;
      case "bankrupt":
        return `${who} bankrutuje`;
    }
  };

  const here = view.turn ? view.positions[view.turn] : 0;

  const pawnIcons = (tile: number, size: string | number) =>
    view.players
      .filter((p) => view.positions[p] === tile && !view.bankrupt.includes(p))
      .map((p) => {
        const Pawn = SEAT_ICONS[seat(p)];
        return (
          <Pawn key={p} size={size} weight="fill" className="drop-shadow-[0_0_2px_var(--color-bg)]" style={{ color: color(p) }} aria-label={nick(p)} />
        );
      });

  /** Zawartość pola na planszy, zależnie od rodzaju. */
  function tileFace(i: number) {
    const tile = BOARD[i];
    const pawns = pawnIcons(i, view.players.filter((p) => view.positions[p] === i).length > 1 ? "45%" : "60%");
    const sellable = selling && view.owners[i] === me;
    const priceTag = (
      <span className="font-mono text-[10px] font-semibold text-fg">{sellable ? `+${saleValue(i)}` : price(i)} zł</span>
    );

    if (tile.kind in CORNERS) {
      const corner = CORNERS[tile.kind];
      return (
        <>
          <corner.icon size={22} weight="fill" style={{ color: corner.color }} aria-hidden />
          <span className="px-1 text-center text-[10px] leading-tight font-semibold text-fg">{tile.name}</span>
          {/* W rogu pionki stoją rzędem pod podpisem, żeby go nie zasłaniać. */}
          <span className="flex h-4 items-center gap-0.5">{pawnIcons(i, 16)}</span>
        </>
      );
    }

    const header =
      tile.kind === "property" ? GROUP_COLORS[tile.group] : tile.kind === "utility" ? UTILITY_COLOR : null;
    const TileIcon = tile.kind === "karty" ? Cards : tile.kind === "tax" ? Bed : null;
    const UtilityIcon = tile.kind === "utility" ? UTILITY_ICONS[tile.name] : null;
    return (
      <>
        {header && (
          <span className="grid h-1/4 w-full shrink-0 place-items-center text-bg" style={{ backgroundColor: header }} aria-hidden>
            {UtilityIcon && <UtilityIcon size={10} weight="bold" />}
          </span>
        )}
        <span className="flex min-h-0 flex-1 flex-col items-center justify-center px-0.5">
          {TileIcon && (
            <TileIcon
              size={tile.kind === "karty" ? 18 : 14}
              weight={tile.kind === "karty" ? "fill" : "regular"}
              style={{ color: tile.kind === "karty" ? CARDS_COLOR : undefined }}
              className="text-fg"
              aria-hidden
            />
          )}
          <span className="text-center text-[9px] leading-tight text-fg">{tile.kind === "karty" ? "Dziekanat" : (SHORT[i] ?? tile.name)}</span>
        </span>
        {tile.kind !== "karty" && <span className="pb-0.5">{priceTag}</span>}
        {pawns.length > 0 && (
          <span className={`absolute inset-x-0 top-1/4 bottom-0 grid place-items-center ${pawns.length > 1 ? "grid-cols-2" : ""}`}>{pawns}</span>
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
      rows.push(["Cena", `${tile.price} zł`], ["Czynsz", `${baseRent(tile.price)} zł`], ["Cała grupa", `${baseRent(tile.price) * 2} zł`]);
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
      text = "Wkrótce: losujesz kartę ze stypendium, warunkiem, poprawką i innymi niespodziankami. Na razie bez efektu.";
    } else {
      accent = CORNERS[tile.kind].color;
      text = CORNERS[tile.kind].info;
    }
    const sellable = selling && owner === me;

    return (
      <div
        className="z-10 flex flex-col gap-2 overflow-auto rounded-inset border border-line bg-surface p-3"
        style={{ gridColumn: "2 / 12", gridRow: "2 / 6", borderTop: `6px solid ${accent}` }}
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
      </div>
    );
  }

  return (
    <main className="landscape p-[max(0.5rem,env(safe-area-inset-top))_max(0.5rem,env(safe-area-inset-right))_max(0.5rem,env(safe-area-inset-bottom))_max(0.5rem,env(safe-area-inset-left))]">
      <div className="relative flex h-full items-center justify-center px-24">
        {view.players.map((id, i) => {
          const Pawn = SEAT_ICONS[i];
          const active = view.turn === id;
          const out = view.bankrupt.includes(id);
          return (
            <div
              key={id}
              className={`absolute flex w-22 flex-col items-center gap-0.5 rounded-inset border p-1.5 text-center text-xs ${SEAT_CORNERS[i]} ${
                active ? "border-line-hover bg-surface" : "border-transparent text-fg-muted"
              } ${out ? "opacity-40" : ""}`}
            >
              <Pawn size={26} weight="fill" style={{ color: color(id) }} aria-hidden />
              <span className={`w-full truncate ${out ? "line-through" : ""}`}>
                {nick(id)}
                {id === me && " (ty)"}
              </span>
              <span className="font-mono text-fg">{out ? "bankrut" : `${view.cash[id]} zł`}</span>
              {over && <span className="font-mono">{ranking.indexOf(id) + 1}. miejsce</span>}
            </div>
          );
        })}

        {/* Plansza 13:7 (rogi 1,5 raza większe) możliwie duża w dostępnym miejscu (jednostki kontenera). */}
        <div className="grid h-full w-full place-items-center" style={{ containerType: "size" }}>
          <div
            className="grid gap-[2px]"
            style={{
              width: "min(100cqw, calc(100cqh * 13 / 7))",
              aspectRatio: "13 / 7",
              gridTemplateColumns: "1.5fr repeat(10, 1fr) 1.5fr",
              gridTemplateRows: "1.5fr repeat(4, 1fr) 1.5fr",
            }}
          >
            {BOARD.map((tile, i) => {
              const [x, y] = cell(i);
              const owner = view.owners[i];
              const sellable = selling && owner === me;
              const background =
                tile.kind in CORNERS
                ? mix(CORNERS[tile.kind].color, 22)
                : tile.kind === "karty"
                  ? mix(CARDS_COLOR, 14)
                  : owner
                    ? mix(color(owner), 35)
                    : undefined;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={tile.name}
                  aria-pressed={selected === i}
                  className={`relative flex flex-col items-center justify-center overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--color-fg)_12%,var(--color-bg))] ${
                    sellable ? "outline-2 outline-accent" : selected === i ? "outline-2 outline-fg" : ""
                  }`}
                  style={{ gridColumn: x + 1, gridRow: y + 1, backgroundColor: background }}
                  onClick={() => setSelected(selected === i ? null : i)}
                >
                  {tileFace(i)}
                </button>
              );
            })}

            <div className="flex flex-col items-center justify-center gap-1.5 overflow-hidden p-2" style={{ gridColumn: "2 / 12", gridRow: "2 / 6" }}>
              <p className="label">
                Kampus Tour · runda {view.round}/{ROUNDS}
              </p>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold">{status}</h1>
                {timer}
              </div>
              {dropped && (
                <p role="status" className="flex items-center gap-2 text-sm text-accent">
                  <WifiSlash size={16} aria-hidden />
                  Łączenie ponownie…
                </p>
              )}
              {view.events.length > 0 && (
                <ul className="text-center text-xs text-fg-muted">
                  {view.events.map((e, i) => (
                    <li key={i}>{describe(e)}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-3">
                {view.dice && (
                  <span className="flex gap-1" aria-label={`Wyrzucono ${view.dice[0]} i ${view.dice[1]}`}>
                    {view.dice.map((d, i) => {
                      const Die = DICE[d - 1];
                      return <Die key={i} size={32} weight="fill" aria-hidden />;
                    })}
                  </span>
                )}
                {canMove && view.phase === "roll" && (
                  <button type="button" className="btn btn-primary" onClick={() => onMove({ type: "roll" })}>
                    Rzuć kośćmi
                  </button>
                )}
                {canMove && view.phase === "buy" && (
                  <>
                    <button type="button" className="btn btn-primary" onClick={() => onMove({ type: "buy" })}>
                      Kup {SHORT[here] ?? BOARD[here].name} za {price(here)} zł
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => onMove({ type: "skip" })}>
                      Pomiń
                    </button>
                  </>
                )}
                {!canMove && view.phase === "buy" && <p className="text-sm text-fg-muted">{nick(view.turn!)} decyduje o zakupie</p>}
              </div>

              {view.phase === "sell" && view.debt && (
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
    </main>
  );
}
