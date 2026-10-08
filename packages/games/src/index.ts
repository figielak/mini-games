import type { GameDefinition } from "./core.ts";
import { chinczyk } from "./chinczyk.ts";
import { kampusTour } from "./kampus-tour.ts";
import { kolo } from "./kolo.ts";
import { liczenie } from "./liczenie.ts";
import { panstwaMiasta } from "./panstwa-miasta.ts";
import { piecWRzedzie } from "./piec-w-rzedzie.ts";
import { refleks } from "./refleks.ts";
import { schulte } from "./schulte.ts";
import { simon } from "./simon.ts";
import { statki } from "./statki.ts";
import { stoper } from "./stoper.ts";
import { stroop } from "./stroop.ts";

export * from "./core.ts";
export * from "./lobby.ts";
export { TRACK as CHINCZYK_TRACK, type View as ChinczykView } from "./chinczyk.ts";
export {
  ALLOWANCE as KAMPUS_ALLOWANCE,
  BOARD as KAMPUS_BOARD,
  CARDS as KAMPUS_CARDS,
  CHARACTERS as KAMPUS_CHARACTERS,
  GROUPS as KAMPUS_GROUPS,
  baseRent as kampusBaseRent,
  buildCost as kampusBuildCost,
  LANDMARK as KAMPUS_LANDMARK,
  LEVEL_RENT as KAMPUS_LEVEL_RENT,
  maxLevel as kampusMaxLevel,
  ROUNDS as KAMPUS_ROUNDS,
  setOf as kampusSetOf,
  UTILITY_RATES as KAMPUS_UTILITY_RATES,
  type Event as KampusEvent,
  type Move as KampusMove,
  type Stats as KampusStats,
  type TileKind as KampusTileKind,
  type View as KampusTourView,
} from "./kampus-tour.ts";
export {
  ANSWER_MAX as PM_ANSWER_MAX,
  CATEGORIES as PM_CATEGORIES,
  fits as pmFits,
  type Move as PanstwaMiastaMove,
  normalize as pmNormalize,
  type View as PanstwaMiastaView,
} from "./panstwa-miasta.ts";
export type { View as PiecWRzedzieView } from "./piec-w-rzedzie.ts";
export { DURATION_MS as REFLEKS_DURATION_MS, type View as RefleksView } from "./refleks.ts";
export type { View as SimonView } from "./simon.ts";
export { PENALTY_MS as SCHULTE_PENALTY_MS, SIZE as SCHULTE_SIZE, total as schulteTotal, type View as SchulteView } from "./schulte.ts";
export { TARGET_MS as STOPER_TARGET_MS, VISIBLE_MS as STOPER_VISIBLE_MS, type View as StoperView } from "./stoper.ts";
export { COLORS as STROOP_COLORS, type View as StroopView } from "./stroop.ts";
export type { View as LiczenieView } from "./liczenie.ts";
export { judge as koloJudge, MAX_POINTS as KOLO_MAX_POINTS, type Point as KoloPoint, type View as KoloView } from "./kolo.ts";
export { DURATION_MS as QUIZ_DURATION_MS, type QuizMove } from "./quiz.ts";
export { FLEET_LENGTHS, isValidFleet, randomFleet, SIZE as STATKI_SIZE, type Ship, shipCells, type Shot, type View as StatkiView } from "./statki.ts";

// ponytail: `any`, bo każda gra ma inny stan i ruch; platforma rozmawia z nimi tylko przez GameDefinition
export const GAMES: Record<string, GameDefinition<any, any>> = {
  [piecWRzedzie.id]: piecWRzedzie,
  [statki.id]: statki,
  [chinczyk.id]: chinczyk,
  [kampusTour.id]: kampusTour,
  [refleks.id]: refleks,
  [simon.id]: simon,
  [stoper.id]: stoper,
  [schulte.id]: schulte,
  [stroop.id]: stroop,
  [liczenie.id]: liczenie,
  [kolo.id]: kolo,
  [panstwaMiasta.id]: panstwaMiasta,
};
