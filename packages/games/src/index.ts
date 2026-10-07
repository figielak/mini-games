import type { GameDefinition } from "./core.ts";
import { chinczyk } from "./chinczyk.ts";
import { kampusTour } from "./kampus-tour.ts";
import { piecWRzedzie } from "./piec-w-rzedzie.ts";
import { statki } from "./statki.ts";

export * from "./core.ts";
export * from "./lobby.ts";
export { TRACK as CHINCZYK_TRACK, type View as ChinczykView } from "./chinczyk.ts";
export {
  ALLOWANCE as KAMPUS_ALLOWANCE,
  BOARD as KAMPUS_BOARD,
  baseRent as kampusBaseRent,
  ROUNDS as KAMPUS_ROUNDS,
  setOf as kampusSetOf,
  UTILITY_RATES as KAMPUS_UTILITY_RATES,
  type Event as KampusEvent,
  type Move as KampusMove,
  type TileKind as KampusTileKind,
  type View as KampusTourView,
} from "./kampus-tour.ts";
export type { View as PiecWRzedzieView } from "./piec-w-rzedzie.ts";
export { FLEET_LENGTHS, isValidFleet, randomFleet, SIZE as STATKI_SIZE, type Ship, shipCells, type Shot, type View as StatkiView } from "./statki.ts";

// ponytail: `any`, bo każda gra ma inny stan i ruch; platforma rozmawia z nimi tylko przez GameDefinition
export const GAMES: Record<string, GameDefinition<any, any>> = {
  [piecWRzedzie.id]: piecWRzedzie,
  [statki.id]: statki,
  [chinczyk.id]: chinczyk,
  [kampusTour.id]: kampusTour,
};
