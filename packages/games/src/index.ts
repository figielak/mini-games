import type { GameDefinition } from "./core.ts";
import { piecWRzedzie } from "./piec-w-rzedzie.ts";

export * from "./core.ts";
export * from "./lobby.ts";
export type { View as PiecWRzedzieView } from "./piec-w-rzedzie.ts";

// ponytail: `any`, bo każda gra ma inny stan i ruch; platforma rozmawia z nimi tylko przez GameDefinition
export const GAMES: Record<string, GameDefinition<any, any>> = {
  [piecWRzedzie.id]: piecWRzedzie,
};
