import type { GameDefinition } from "./core.ts";
import { chinczyk } from "./chinczyk.ts";
import { piecWRzedzie } from "./piec-w-rzedzie.ts";
import { statki } from "./statki.ts";

export * from "./core.ts";
export * from "./lobby.ts";
export { TRACK as CHINCZYK_TRACK, type View as ChinczykView } from "./chinczyk.ts";
export type { View as PiecWRzedzieView } from "./piec-w-rzedzie.ts";
export { FLEET_LENGTHS, isValidFleet, randomFleet, SIZE as STATKI_SIZE, type Ship, shipCells, type Shot, type View as StatkiView } from "./statki.ts";

// ponytail: `any`, bo każda gra ma inny stan i ruch; platforma rozmawia z nimi tylko przez GameDefinition
export const GAMES: Record<string, GameDefinition<any, any>> = {
  [piecWRzedzie.id]: piecWRzedzie,
  [statki.id]: statki,
  [chinczyk.id]: chinczyk,
};
