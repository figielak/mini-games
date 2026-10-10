import type { GameDefinition } from "./core.ts";
import { chinczyk } from "./chinczyk.ts";
import { kampusTour } from "./kampus-tour.ts";
import { kolo } from "./kolo.ts";
import { kolor } from "./kolor.ts";
import { kropki } from "./kropki.ts";
import { liczenie } from "./liczenie.ts";
import { panstwaMiasta } from "./panstwa-miasta.ts";
import { piecWRzedzie } from "./piec-w-rzedzie.ts";
import { refleks } from "./refleks.ts";
import { schulte } from "./schulte.ts";
import { simon } from "./simon.ts";
import { srodek } from "./srodek.ts";
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
export { VISIBLE_MS as STOPER_VISIBLE_MS, type View as StoperView } from "./stoper.ts";
export { COLORS as STROOP_COLORS, type View as StroopView } from "./stroop.ts";
export type { View as LiczenieView } from "./liczenie.ts";
export { ATTEMPTS as KOLO_ATTEMPTS, judge as koloJudge, MAX_POINTS as KOLO_MAX_POINTS, type Point as KoloPoint, type View as KoloView } from "./kolo.ts";
export { COUNT as KOLOR_COUNT, distance as kolorDistance, type Hsb, hints as kolorHints, hsbToRgb as kolorHsbToRgb, SHOW_MS as KOLOR_SHOW_MS, type View as KolorView } from "./kolor.ts";
export { ROUNDS as KROPKI_ROUNDS, SHOW_MS as KROPKI_SHOW_MS, type View as KropkiView } from "./kropki.ts";
export { distance as srodekDistance, FIELD as SRODEK_FIELD, type Point as SrodekPoint, ROUNDS as SRODEK_ROUNDS, type View as SrodekView } from "./srodek.ts";
export { DURATION_MS as QUIZ_DURATION_MS, type QuizMove } from "./quiz.ts";
export { around as shipAround, isValidFleet, MODES as STATKI_MODES, randomFleet, type Rules as StatkiRules, type Ship, shipCells, type Shot, type View as StatkiView } from "./statki.ts";

// ponytail: `any`, bo każda gra ma inny stan i ruch; platforma rozmawia z nimi tylko przez GameDefinition
// Bez prototypu: gameId przychodzi z sieci, a GAMES["constructor"] na zwykłym obiekcie zwróciłoby funkcję zamiast gry.
export const GAMES: Record<string, GameDefinition<any, any>> = Object.assign(Object.create(null), {
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
  [kolor.id]: kolor,
  [kropki.id]: kropki,
  [srodek.id]: srodek,
  [panstwaMiasta.id]: panstwaMiasta,
});
