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
  GraduationCap,
  type Icon,
  Sun,
  WifiSlash,
} from "@phosphor-icons/react";
import {
  KAMPUS_BOARD as BOARD,
  KAMPUS_ROUNDS as ROUNDS,
  type KampusEvent,
  type KampusMove,
  type KampusTileKind,
  type KampusTourView,
  type LobbyPlayer,
} from "@mini-games/games";
import type { ReactNode } from "react";

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
/** Paski grup, celowo inne niż kolory graczy (tło pola w kolorze gracza oznacza właściciela). */
const GROUP_COLORS = ["#a0785a", "#7cc4e6", "#d873b0", "#f0913c", "#e5484d", "#e8d44d", "#4caf7d", "#5b6fd6"];

const TILES: Partial<Record<KampusTileKind, { icon: Icon; name?: string }>> = {
  start: { icon: Sun, name: "Początek dnia" },
  kolokwium: { icon: Exam, name: "Kolokwium" },
  juwenalia: { icon: Confetti, name: "Juwenalia" },
  mpk: { icon: Bus, name: "Bilet MPK" },
  karty: { icon: Cards },
  tax: { icon: Bed },
};

const mix = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--color-bg))`;
const price = (tile: number) => {
  const t = BOARD[tile];
  return t.kind === "property" ? t.price : t.kind === "tax" ? t.amount : 0;
};

/** Pole planszy 12×6 → [kolumna, wiersz], od lewego górnego rogu zgodnie z ruchem wskazówek zegara. */
function cell(i: number): [number, number] {
  if (i <= 11) return [i, 0];
  if (i <= 15) return [11, i - 11];
  if (i <= 27) return [27 - i, 5];
  return [0, 32 - i];
}

export function KampusTour({ view, me, players, dropped, canMove, ranking, onMove, timer, actions }: Props) {
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
        return `${who} kupuje pole za ${e.amount} zł`;
      case "rent":
        return `${who} płaci ${e.amount} zł czynszu → ${nick(e.to!)}`;
      case "tax":
        return `${who} płaci ${e.amount} zł za akademik`;
      case "sell":
        return `${who} sprzedaje pole za ${e.amount} zł`;
      case "bankrupt":
        return `${who} bankrutuje`;
    }
  };

  const here = view.turn ? view.positions[view.turn] : 0;

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

        {/* Plansza 2:1 możliwie duża w dostępnym miejscu (jednostki kontenera). */}
        <div className="grid h-full w-full place-items-center" style={{ containerType: "size" }}>
          <div
            className="grid gap-[2px]"
            style={{ width: "min(100cqw, 200cqh)", aspectRatio: "2 / 1", gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "repeat(6, 1fr)" }}
          >
            {BOARD.map((tile, i) => {
              const [x, y] = cell(i);
              const info = TILES[tile.kind];
              const pawns = view.players.filter((p) => view.positions[p] === i && !view.bankrupt.includes(p));
              const owner = view.owners[i];
              const sellable = selling && owner === me;
              const content = (
                <>
                  {tile.kind === "property" && (
                    <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: GROUP_COLORS[tile.group] }} aria-hidden />
                  )}
                  {info && (
                    <span className="flex flex-col items-center text-center text-[9px] leading-tight">
                      <info.icon size={info.name ? 18 : 16} aria-hidden />
                      {info.name}
                    </span>
                  )}
                  {(tile.kind === "property" || tile.kind === "tax") && (
                    <span className="absolute bottom-0.5 font-mono text-[9px]">{sellable ? `+${Math.floor(price(i) / 2)}` : price(i)} zł</span>
                  )}
                  {pawns.length > 0 && (
                    <span className={`absolute inset-0 grid place-items-center p-0.5 ${pawns.length > 1 ? "grid-cols-2" : ""}`}>
                      {pawns.map((p) => {
                        const Pawn = SEAT_ICONS[seat(p)];
                        return (
                          <Pawn
                            key={p}
                            size={pawns.length > 1 ? "90%" : "65%"}
                            weight="fill"
                            className="drop-shadow-[0_0_2px_var(--color-bg)]"
                            style={{ color: color(p) }}
                            aria-label={nick(p)}
                          />
                        );
                      })}
                    </span>
                  )}
                </>
              );
              const className = `relative grid place-items-center overflow-hidden rounded-[4px] bg-[color-mix(in_srgb,var(--color-fg)_9%,var(--color-bg))] text-fg-muted ${
                sellable ? "outline-2 outline-accent" : ""
              }`;
              const style = { gridColumn: x + 1, gridRow: y + 1, backgroundColor: owner ? mix(color(owner), 30) : undefined };
              return sellable ? (
                <button
                  key={i}
                  type="button"
                  className={className}
                  style={style}
                  aria-label={`Sprzedaj pole za ${Math.floor(price(i) / 2)} zł`}
                  onClick={() => onMove({ type: "sell", tile: i })}
                >
                  {content}
                </button>
              ) : (
                <div key={i} className={className} style={style}>
                  {content}
                </div>
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
                      Kup za {price(here)} zł
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
                    ? `Brakuje ${view.debt.amount - view.cash[me]} zł. Dotknij swojego pola, żeby sprzedać je za pół ceny.`
                    : `${nick(view.turn!)} sprzedaje pola, żeby spłacić ${view.debt.amount} zł`}
                </p>
              )}
              {actions && <div className="flex w-full max-w-xs gap-2">{actions}</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
