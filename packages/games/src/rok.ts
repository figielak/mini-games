import { z } from "zod";
import { type GameDefinition, type PlayerId, rankResults, shuffle } from "./core.ts";

export const ROUNDS = 10;
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2025;
export const ROUND_MS = 20000;
export const REVEAL_MS = 2500;

export type Event = { text: string; year: number };

export type Move = { type: "result"; answers: number[] } | { type: "progress"; done: number };

export interface State {
  players: PlayerId[];
  events: Event[];
  results: Record<PlayerId, number>;
  answers: Record<PlayerId, number[]>;
  progress: Record<PlayerId, number>;
}

export type View = State;

const worst = (year: number) => Math.max(year - MIN_YEAR, MAX_YEAR - year);

export const EVENTS: Event[] = [
  { text: "Pierwszy lot braci Wright", year: 1903 },
  { text: "Otwarcie kanału panamskiego", year: 1914 },
  { text: "Początek I wojny światowej", year: 1914 },
  { text: "Zwycięstwo w wojnie domowej w Rosji", year: 1922 },
  { text: "Tworzenie Związku Radzieckiego", year: 1922 },
  { text: "Pierwsza wizyta w stacji radiowej z audycją broadcast", year: 1920 },
  { text: "Wielki kryzys gospodarczy w USA", year: 1929 },
  { text: "Wielki kryzys in the world", year: 1929 },
  { text: "Adolf Hitler objął władzę", year: 1933 },
  { text: "Początek II wojny światowej", year: 1939 },
  { text: "Poczynania w Polsce po kampanii wrześniowej", year: 1939 },
  { text: "Bitwa pod Stalingradem", year: 1943 },
  { text: "Zatopienie ostatniego sztandaru Niemiec", year: 1945 },
  { text: "Oficjalne zakończenie II wojny światowej", year: 1945 },
  { text: "Pierwsze użycie bomby atomowej", year: 1945 },
  { text: "Powołanie Organizacji Narodów Zjednoczonych", year: 1945 },
  { text: "Początek zimnej wojny", year: 1947 },
  { text: "Rozpad imperium brytyjskiego", year: 1947 },
  { text: "Pierwszy lot samolotem odrzutowym", year: 1947 },
  { text: "Powstanie pierwszego państwa izraelskiego", year: 1948 },
  { text: "Początek wyścigu kosmicznego", year: 1957 },
  { text: "Pierwszy sztuczny satelita", year: 1957 },
  { text: "Pierwszy lot w kosmos", year: 1961 },
  { text: "Pierwsza wylot na Księżyc", year: 1969 },
  { text: "Pierwszy ląding na Księżycu", year: 1969 },
  { text: "Rozpad Związku Radzieckiego", year: 1991 },
  { text: "Pierwsze założenia sieci internetowej", year: 1969 },
  { text: "Powstanie pierwszego platformowego komunikatora", year: 1971 },
  { text: "Pierwsze publiczne użycie komputera osobistego", year: 1975 },
  { text: "Wprowadzenie osobistych komputerów do sprzedaży", year: 1975 },
  { text: "Początek globalnego internetu w formie publicznej", year: 1983 },
  { text: "Odkrycie HIV i AIDS", year: 1983 },
  { text: "Powstanie pierwszego globalnego systemu telekomunikacji mobilnej", year: 1983 },
  { text: "Upadek muru berlińskiego", year: 1989 },
  { text: "Powstanie pierwszej wolnej Polski po 1989", year: 1989 },
  { text: "Pierwsza wojna w Zatoce Perskiej", year: 1990 },
  { text: "Powstanie pierwszego współczesnego internetu w Polsce", year: 1990 },
  { text: "Pierwsze ogólnoświatowe puzzel wideo w sieci", year: 1995 },
  { text: "Pierwszy przemysłowy internet mobilny", year: 1997 },
  { text: "Wprowadzenie pierwszego telefonu z ekranem dotykowym", year: 2007 },
  { text: "Początek rewolucji w mediach społecznościowych", year: 2008 },
  { text: "Przejście do pierwszej powszechnej platformy streamingowej", year: 2011 },
  { text: "Rozpoczęcie współczesnej ery smartfonów", year: 2007 },
  { text: "Rewolucja w telefonach komórkowych z ekranem dotykowym", year: 2007 },
  { text: "Pierwsze pełne wejście w erę chmury obliczeniowej", year: 2010 },
  { text: "Początek globalnego boomu na platformy wideo", year: 2005 },
  { text: "Sfinal i wyzwanie w zakresie sztucznej inteligencji", year: 2023 },
  { text: "Początek pandemii i zakłóceń w społeczeństwie", year: 2020 },
  { text: "Obchody pierwszej w historii w Polsce mobilności cyfrowej", year: 2007 },
  { text: "Pierwsza wystawa w Muzeum Sztuki Nowoczesnej", year: 1914 },
  { text: "Początek walk o niepodległość Polski", year: 1918 },
  { text: "Odrodzenie państwa polskiego", year: 1918 },
  { text: "Pierwszy powstanie wielkopolskie", year: 1918 },
  { text: "Początek rządów sanacji", year: 1926 },
  { text: "Przewrót majowy w Polsce", year: 1926 },
  { text: "Festiwal którejś z wielkich tragedii w Polsce", year: 1939 },
  { text: "Obrona Warszawy w kampanii wrześniowej", year: 1939 },
  { text: "Rozpoczęcie tajnego nauczania w okupacji", year: 1939 },
  { text: "Powstanie warszawskie", year: 1944 },
  { text: "Koniec okupacji w Polsce", year: 1945 },
  { text: "Powołanie Polskiej Rzeczypospolitej Ludowej", year: 1947 },
  { text: "Nowa konstytucja państwa polskiego", year: 1952 },
  { text: "Zjazd pierwszych zorganizowanych studentów w Polsce", year: 1956 },
  { text: "Powstanie w Poznaniu", year: 1956 },
  { text: "Październik i odnowa polityczna", year: 1956 },
  { text: "Początek wzrostu gospodarki polskiej", year: 1970 },
  { text: "Wprowadzenie stanu wojennego", year: 1981 },
  { text: "Odsłonięcie pierwszego pomnika wolności w Polsce", year: 1989 },
  { text: "Powrót do niepodległej Rzeczypospolitej", year: 1989 },
  { text: "Pierwsze wybory po 1989", year: 1989 },
  { text: "Wpływ polityki gospodarczej na polską gospodarkę", year: 1990 },
  { text: "Polska wstąpiła do Unii Europejskiej", year: 2004 },
  { text: "Edycja pierwszych w Polsce telewizji publicznej", year: 1992 },
  { text: "Pierwsza niepodległa polska edycja magazynu telewizyjnego", year: 1989 },
  { text: "Wprowadzenie euro w Polsce", year: 2008 },
  { text: "Początek pierwszej gry w polskim internecie", year: 1996 },
  { text: "Rewolucja w technologii GPS w Polsce", year: 2000 },
  { text: "Belgijska technologia użyta w polskiej komunikacji", year: 2002 },
  { text: "Powstanie nowej sejmowej kadencji po wyborach", year: 2015 },
  { text: "Pierwsza w Polsce kamery w smartfonie", year: 2011 },
  { text: "Pierwsze powszechne wejście do sieci w Polsce", year: 1996 },
  { text: "Wprowadzenie pierwszych aplikacji mobilnych w Polsce", year: 2010 },
  { text: "Powstanie pierwszej subskrypcji filmowej w Polsce", year: 2015 },
  { text: "Pierwsza duża implementacja sieci 5G w Europie", year: 2019 },
  { text: "Przełom w autonomicznych pojazdach", year: 2020 },
  { text: "Premiera pierwszego filmu z serii o superbohaterach", year: 2008 },
  { text: "Początek ery seriali streamingowych", year: 2013 },
  { text: "Premiera pierwszego dużego hitu z gry komputerowej", year: 2001 },
  { text: "Wielki powrót do świata fantasy w kinie", year: 2001 },
  { text: "Premiera pierwszego hitu anime w głównym nurcie", year: 2002 },
  { text: "Powstanie jednej z najpopularniejszych gier mobilnych", year: 2012 },
  { text: "Premiera pierwszego bardzo wpływowego serialu w sieci", year: 2009 },
  { text: "Premiera pierwszej gry z otwartym światem", year: 2006 },
  { text: "Przełom w filmie animowanym z nową technologią", year: 2010 },
  { text: "Premiera pierwszego filmu w nowej erze cyfrowej", year: 2015 },
  { text: "Początek globalnego boomu na gry mobilne", year: 2011 },
  { text: "Premiera pierwszego bardzo reklamowanego serialu sci-fi", year: 2014 },
  { text: "Powstanie jednej z największych platform streamingowych", year: 2016 },
  { text: "Premiera pierwszej kultowej serii fantasy", year: 2008 },
  { text: "Początek pierwszej dużej adaptacji komiksowej", year: 2013 },
  { text: "Premiera pierwszego popularnego serialu kryminalnego", year: 2016 },
  { text: "Wielki sukces pierwszej gry z wieloma graczami online", year: 2018 },
  { text: "Premiera pierwszego hitu muzycznego online", year: 2019 },
  { text: "Początek ery nowej muzyki pop w serwisach streamingowych", year: 2017 },
  { text: "Premiera pierwszego filmu o przygodzie kosmicznej", year: 2015 },
  { text: "Początek ery nowego sposobu oglądania filmów wideo", year: 2010 },
  { text: "Premiera pierwszej nowej globalnej platformy streamingowej", year: 2021 },
  { text: "Wielki sukces pierwszego serialu z miejscem akcji w przeszłości", year: 2017 },
  { text: "Premiera pierwszej gry z rozwojem online", year: 2016 },
  { text: "Globalny boom na seriale o dystopii", year: 2019 },
  { text: "Pierwsza propozycja chatbotów w masowej kulturze", year: 2022 },
  { text: "Polski hit serialowy i nowa era telewizji internetowej", year: 2020 },
  { text: "Pożar w górniczej kopalni z wielkim skutkiem społecznym", year: 2000 },
  { text: "Wielki skok technologiczny w nowej sieci mobilnej", year: 2024 },
  { text: "Początek ulicy nowej cyfrowej technologii", year: 2023 },
  { text: "Rozwój sztucznej inteligencji w codziennym życiu", year: 2024 },
  { text: "Premiera pierwszego wydarzenia w kulturze internetowej", year: 2022 },
  { text: "Wielka reformacja technologii w komunikacji", year: 2021 },
  { text: "Sprzedaż pierwszego telefonu z własnym asystentem", year: 2023 },
  { text: "Początek rynku robotów domowych", year: 2020 },
  { text: "Pierwsze ważne wydarzenie w branży gamingowej", year: 2024 },
  { text: "Mistrzostwo świata w pierwszym zwięzłym formacie streamingu", year: 2022 },
  { text: "Pierwsza różnorodna platforma społecznościowa dla twórców", year: 2023 },
  { text: "Premiera jednego z największych filmów o kosmosie", year: 2024 },
  { text: "Giełda technologiczn z wielkim sukcesem w 2024", year: 2024 },
  { text: "Początek klasycznej ery wykorzystywania AI w pracy", year: 2023 },
  { text: "Wielki projekt rozwoju nowej generacji sieci", year: 2024 },
  { text: "Premiera jednej z najbardziej wpływowych aplikacji mobilnych", year: 2021 },
  { text: "Powstanie kolejnego etapu Nowej Rzeczypospolitej", year: 2015 },
  { text: "Początek prawdziwej zmiany technologicznej w Polsce", year: 2010 },
  { text: "Młody nowy kierunek współczesnej kultury filmowej", year: 2019 },
];

export const rok: GameDefinition<State, Move> = {
  id: "rok",
  name: "Który rok?",
  minPlayers: 1,
  maxPlayers: 6,
  turnSeconds: 240,
  turn: () => ({ key: "run", seconds: 240 }),
  moveSchema: z.discriminatedUnion("type", [
    z.object({ type: z.literal("result"), answers: z.array(z.number()).max(ROUNDS) }),
    z.object({ type: z.literal("progress"), done: z.number() }),
  ]),

  setup: (players, rng) => ({
    players,
    events: shuffle(EVENTS, rng).slice(0, ROUNDS),
    results: {},
    answers: {},
    progress: {},
  }),

  validateMove: (state, player, move) =>
    state.players.includes(player) &&
    !(player in state.results) &&
    (move.type === "progress"
      ? Number.isInteger(move.done) && move.done >= 1 && move.done < ROUNDS
      : move.answers.length === 0 || (move.answers.length === ROUNDS && move.answers.every((year) => Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR))),

  applyMove: (state, player, move) => {
    if (move.type === "progress") {
      return { ...state, progress: { ...state.progress, [player]: move.done } };
    }

    const score = state.events.reduce((sum, event, index) => {
      const answer = move.answers.length === 0 ? worst(event.year) : move.answers[index] ?? 0;
      return sum + Math.abs(answer - event.year);
    }, 0);

    return {
      ...state,
      results: { ...state.results, [player]: score },
      answers: { ...state.answers, [player]: move.answers },
    };
  },

  playerView: (state): View => state,

  isOver: (state) => rankResults(state.players, state.results, (a, b) => a - b),

  waitingFor: (state) => state.players.filter((p) => !(p in state.results)),

  timeoutMove: () => ({ type: "result", answers: [] }),
};
