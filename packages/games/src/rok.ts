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

// Pula wydarzeń z jednoznacznym rokiem, po cztery działy; tekst nie zdradza roku (żadnej czterocyfrowej liczby).
// Premiera = rok pierwszej premiery na świecie. Dopisując pozycję, sprawdź datę w źródle.
export const EVENTS: Event[] = [
  // Historia świata
  { text: "Pierwszy lot samolotu braci Wright", year: 1903 },
  { text: "Zatonięcie Titanica", year: 1912 },
  { text: "Wybuch I wojny światowej", year: 1914 },
  { text: "Rewolucja październikowa w Rosji", year: 1917 },
  { text: "Krach na giełdzie w Nowym Jorku i początek Wielkiego Kryzysu", year: 1929 },
  { text: "Adolf Hitler zostaje kanclerzem Niemiec", year: 1933 },
  { text: "Atak Japonii na Pearl Harbor", year: 1941 },
  { text: "Lądowanie aliantów w Normandii", year: 1944 },
  { text: "Zrzucenie bomby atomowej na Hiroszimę", year: 1945 },
  { text: "Proklamacja niepodległości Izraela", year: 1948 },
  { text: "Powstanie NATO", year: 1949 },
  { text: "Śmierć Józefa Stalina", year: 1953 },
  { text: "Budowa muru berlińskiego", year: 1961 },
  { text: "Kryzys kubański", year: 1962 },
  { text: "Zamach na Johna F. Kennedy'ego", year: 1963 },
  { text: "Zabójstwo Martina Luthera Kinga", year: 1968 },
  { text: "Upadek Sajgonu i koniec wojny w Wietnamie", year: 1975 },
  { text: "Katastrofa elektrowni w Czarnobylu", year: 1986 },
  { text: "Upadek muru berlińskiego", year: 1989 },
  { text: "Zjednoczenie Niemiec", year: 1990 },
  { text: "Rozpad Związku Radzieckiego", year: 1991 },
  { text: "Nelson Mandela zostaje prezydentem RPA", year: 1994 },
  { text: "Śmierć księżnej Diany", year: 1997 },
  { text: "Zamachy na World Trade Center", year: 2001 },
  { text: "Banknoty i monety euro trafiają do obiegu", year: 2002 },
  { text: "Tsunami na Oceanie Indyjskim", year: 2004 },
  { text: "Barack Obama po raz pierwszy wygrywa wybory prezydenckie", year: 2008 },
  { text: "Awaria elektrowni w Fukushimie", year: 2011 },
  { text: "Referendum w sprawie brexitu", year: 2016 },
  { text: "Pożar katedry Notre-Dame w Paryżu", year: 2019 },
  { text: "WHO ogłasza pandemię COVID-19", year: 2020 },
  { text: "Pełnoskalowa inwazja Rosji na Ukrainę", year: 2022 },
  // Historia Polski
  { text: "Polska odzyskuje niepodległość", year: 1918 },
  { text: "Bitwa Warszawska, czyli Cud nad Wisłą", year: 1920 },
  { text: "Przewrót majowy Piłsudskiego", year: 1926 },
  { text: "Śmierć Józefa Piłsudskiego", year: 1935 },
  { text: "Powstanie w getcie warszawskim", year: 1943 },
  { text: "Powstanie warszawskie", year: 1944 },
  { text: "Otwarcie Pałacu Kultury i Nauki", year: 1955 },
  { text: "Poznański Czerwiec", year: 1956 },
  { text: "Protesty studentów w Marcu", year: 1968 },
  { text: "Grudzień na Wybrzeżu", year: 1970 },
  { text: "Polscy piłkarze zdobywają olimpijskie złoto w Monachium", year: 1972 },
  { text: "Polska trzecia na mundialu w RFN", year: 1974 },
  { text: "Karol Wojtyła zostaje papieżem", year: 1978 },
  { text: "Pierwsza pielgrzymka Jana Pawła II do Polski", year: 1979 },
  { text: "Porozumienia sierpniowe i powstanie Solidarności", year: 1980 },
  { text: "Wprowadzenie stanu wojennego", year: 1981 },
  { text: "Pokojowa Nagroda Nobla dla Lecha Wałęsy", year: 1983 },
  { text: "Zabójstwo księdza Jerzego Popiełuszki", year: 1984 },
  { text: "Obrady Okrągłego Stołu", year: 1989 },
  { text: "Lech Wałęsa zostaje prezydentem", year: 1990 },
  { text: "Pierwszy McDonald's w Polsce", year: 1992 },
  { text: "Pierwszy finał Wielkiej Orkiestry Świątecznej Pomocy", year: 1993 },
  { text: "Denominacja złotego", year: 1995 },
  { text: "Otwarcie pierwszej linii metra w Warszawie", year: 1995 },
  { text: "Literacka Nagroda Nobla dla Wisławy Szymborskiej", year: 1996 },
  { text: "Powódź tysiąclecia", year: 1997 },
  { text: "Polska wstępuje do NATO", year: 1999 },
  { text: "Reforma wprowadza 16 województw", year: 1999 },
  { text: "Adam Małysz po raz pierwszy wygrywa Turniej Czterech Skoczni", year: 2001 },
  { text: "Polska wstępuje do Unii Europejskiej", year: 2004 },
  { text: "Śmierć Jana Pawła II", year: 2005 },
  { text: "Polska wchodzi do strefy Schengen", year: 2007 },
  { text: "Robert Kubica wygrywa Grand Prix Kanady", year: 2008 },
  { text: "Katastrofa smoleńska", year: 2010 },
  { text: "Mistrzostwa Europy w piłce nożnej w Polsce i na Ukrainie", year: 2012 },
  { text: "Rusza program 500 plus", year: 2016 },
  { text: "Iga Świątek po raz pierwszy wygrywa Roland Garros", year: 2020 },
  // Wynalazki i technologia
  { text: "Einstein ogłasza szczególną teorię względności", year: 1905 },
  { text: "Ford Model T trafia do sprzedaży", year: 1908 },
  { text: "Alexander Fleming odkrywa penicylinę", year: 1928 },
  { text: "Odkrycie Plutona", year: 1930 },
  { text: "Watson i Crick opisują strukturę DNA", year: 1953 },
  { text: "Sputnik, pierwszy sztuczny satelita Ziemi", year: 1957 },
  { text: "Jurij Gagarin pierwszym człowiekiem w kosmosie", year: 1961 },
  { text: "Pierwszy przeszczep serca u człowieka", year: 1967 },
  { text: "Pierwszy człowiek staje na Księżycu", year: 1969 },
  { text: "Pierwszy lot Concorde'a", year: 1969 },
  { text: "Wysłanie pierwszego e-maila", year: 1971 },
  { text: "Sony wypuszcza Walkmana", year: 1979 },
  { text: "Premiera komputera IBM PC", year: 1981 },
  { text: "Pierwszy lot wahadłowca Columbia", year: 1981 },
  { text: "Premiera komputera Apple Macintosh", year: 1984 },
  { text: "Premiera konsoli Game Boy", year: 1989 },
  { text: "Teleskop Hubble'a trafia na orbitę", year: 1990 },
  { text: "Wysłanie pierwszego SMS-a", year: 1992 },
  { text: "Premiera pierwszej konsoli PlayStation w Japonii", year: 1994 },
  { text: "Otwarcie Eurotunelu pod kanałem La Manche", year: 1994 },
  { text: "Narodziny sklonowanej owcy Dolly", year: 1996 },
  { text: "Komputer Deep Blue pokonuje Garriego Kasparowa", year: 1997 },
  { text: "Powstanie firmy Google", year: 1998 },
  { text: "Start Wikipedii", year: 2001 },
  { text: "Premiera pierwszego iPoda", year: 2001 },
  { text: "Zakończenie projektu poznania ludzkiego genomu", year: 2003 },
  { text: "Powstanie Facebooka", year: 2004 },
  { text: "Powstanie YouTube'a", year: 2005 },
  { text: "Start Twittera", year: 2006 },
  { text: "Premiera pierwszego iPhone'a", year: 2007 },
  { text: "Pierwszy telefon z Androidem trafia do sprzedaży", year: 2008 },
  { text: "Wydobycie pierwszego bloku Bitcoina", year: 2009 },
  { text: "Premiera pierwszego iPada", year: 2010 },
  { text: "Start Instagrama", year: 2010 },
  { text: "CERN ogłasza odkrycie bozonu Higgsa", year: 2012 },
  { text: "Łazik Curiosity ląduje na Marsie", year: 2012 },
  { text: "Pierwsze udane lądowanie rakiety Falcon 9", year: 2015 },
  { text: "Program AlphaGo pokonuje mistrza go Lee Sedola", year: 2016 },
  { text: "Premiera konsoli Nintendo Switch", year: 2017 },
  { text: "Pierwsze zdjęcie czarnej dziury", year: 2019 },
  { text: "Start Kosmicznego Teleskopu Jamesa Webba", year: 2021 },
  { text: "Premiera ChatGPT", year: 2022 },
  // Popkultura
  { text: "Premiera „Królewny Śnieżki i siedmiu krasnoludków” Disneya", year: 1937 },
  { text: "Premiera filmu „Przeminęło z wiatrem”", year: 1939 },
  { text: "Premiera filmu „Casablanca”", year: 1942 },
  { text: "Premiera „Psychozy” Hitchcocka", year: 1960 },
  { text: "Premiera „Krzyżaków” Aleksandra Forda", year: 1960 },
  { text: "„Doktor No”, pierwszy film o Jamesie Bondzie", year: 1962 },
  { text: "Pierwszy odcinek „Czterech pancernych i psa”", year: 1966 },
  { text: "Beatlesi wydają album „Sgt. Pepper's Lonely Hearts Club Band”", year: 1967 },
  { text: "Festiwal Woodstock", year: 1969 },
  { text: "Premiera filmu „Rejs”", year: 1970 },
  { text: "Premiera „Ojca chrzestnego”", year: 1972 },
  { text: "Premiera „Szczęk” Spielberga", year: 1975 },
  { text: "Premiera pierwszych „Gwiezdnych wojen”", year: 1977 },
  { text: "Śmierć Elvisa Presleya", year: 1977 },
  { text: "Zabójstwo Johna Lennona", year: 1980 },
  { text: "Premiera „Misia” Stanisława Barei", year: 1981 },
  { text: "Michael Jackson wydaje album „Thriller”", year: 1982 },
  { text: "Premiera filmu „E.T.”", year: 1982 },
  { text: "Premiera „Seksmisji”", year: 1984 },
  { text: "Powstaje gra „Tetris”", year: 1984 },
  { text: "Premiera „Powrotu do przyszłości”", year: 1985 },
  { text: "Premiera gry „Super Mario Bros.”", year: 1985 },
  { text: "Koncert Live Aid", year: 1985 },
  { text: "Pierwszy pełny odcinek „Simpsonów”", year: 1989 },
  { text: "Premiera filmu „Kevin sam w domu”", year: 1990 },
  { text: "Nirvana wydaje album „Nevermind”", year: 1991 },
  { text: "Premiera „Parku Jurajskiego”", year: 1993 },
  { text: "Premiera animowanego „Króla Lwa”", year: 1994 },
  { text: "Premiera „Pulp Fiction”", year: 1994 },
  { text: "Pierwszy odcinek „Przyjaciół”", year: 1994 },
  { text: "Premiera „Toy Story”", year: 1995 },
  { text: "Premiera „Titanica” Jamesa Camerona", year: 1997 },
  { text: "Pierwsza książka o Harrym Potterze", year: 1997 },
  { text: "Pierwszy odcinek serialu „Klan”", year: 1997 },
  { text: "Premiera „Matrixa”", year: 1999 },
  { text: "Pierwszy odcinek „M jak miłość”", year: 2000 },
  { text: "Premiera „Władcy Pierścieni: Drużyny Pierścienia”", year: 2001 },
  { text: "Premiera pierwszego „Shreka”", year: 2001 },
  { text: "Pierwsza polska edycja „Big Brothera”", year: 2001 },
  { text: "Premiera pierwszej gry „Wiedźmin”", year: 2007 },
  { text: "Pierwszy odcinek „Breaking Bad”", year: 2008 },
  { text: "Premiera „Avatara”", year: 2009 },
  { text: "Śmierć Michaela Jacksona", year: 2009 },
  { text: "Pierwszy odcinek „Gry o tron”", year: 2011 },
  { text: "Teledysk „Gangnam Style” podbija YouTube'a", year: 2012 },
  { text: "Premiera gry „GTA V”", year: 2013 },
  { text: "Premiera gry „Wiedźmin 3: Dziki Gon”", year: 2015 },
  { text: "Premiera gry „Pokémon GO”", year: 2016 },
  { text: "Pierwszy sezon „Stranger Things”", year: 2016 },
  { text: "Premiera gry „Fortnite”", year: 2017 },
  { text: "Premiera filmu „Avengers: Koniec gry”", year: 2019 },
  { text: "Premiera serialu „Squid Game”", year: 2021 },
  { text: "Kinowy pojedynek „Barbie” i „Oppenheimera”", year: 2023 },
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
      // Pusta lista (limit czasu) to najgorszy możliwy błąd w każdej rundzie.
      return sum + (move.answers.length === 0 ? worst(event.year) : Math.abs(move.answers[index] - event.year));
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
