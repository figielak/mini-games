# games.figielak.dev — koncept

Prywatna platforma z grami multiplayer w przeglądarce, do grania ze znajomymi na wykładach.
Jedna strona, kod pokoju, każdy gra na swoim telefonie.

## 1. Założenia

- **Do 6 graczy naraz** w pokoju, kilka pokoi równolegle. Limit miejsc zależy od gry
  (Kampus Tour i Chińczyk 2-4, Gomoku i Statki 2); reszta ogląda.
- **Mobile-first**: telefon w pionie, bez instalacji (PWA z ikoną na ekranie głównym).
- **Bez kont**: gracz wpisuje nick i kod pokoju. Token sesji w `localStorage` pozwala wrócić do gry po odświeżeniu strony.
- **Dostęp**: strona publiczna, ale do gry trzeba znać kod pokoju. Brak publicznej listy pokoi.
- **Odporność na słabe Wi-Fi**: automatyczne ponowne łączenie, stan gry zawsze po stronie serwera.
- **Tryb wykładowy**: domyślnie bez dźwięku, ciemny motyw, wibracje zamiast powiadomień, limit czasu na turę.

## 2. Gry

### 2.1 Kampus Tour (klon Business Tour)

Główna gra platformy, 2-4 graczy. Zachowuje rdzeń mechaniki oryginału, ale ma własny motyw i dodatki.
Mechanik można się inspirować, natomiast nazwy, grafiki i logo oryginału nie są kopiowane.

**Motyw:** Politechnika Rzeszowska i Rzeszów. Pola to budynki kampusu, wydziały i znane miejsca w mieście
(np. Rynek, Zamek Lubomirskich, Bulwary nad Wisłokiem, Millenium Hall). Lista pól: `GROUP_DEFS` i `SPECIAL` w `kampus-tour.ts`.

**Rdzeń (jak w oryginale):**
- pozioma plansza 32 pól (prostokąt 12×6, rogi: Początek, Kolokwium, Juwenalia, Bilet MPK), rzut dwiema kośćmi, dublet daje dodatkowy rzut (trzeci z rzędu wysyła na Kolokwium),
- 2-4 graczy, każdy wybiera na starcie postać (pionek),
- kupowanie pól i płacenie czynszu; gdy brakuje gotówki, sprzedaż pól bankowi za połowę wartości,
- 8 grup kolorów (pory dnia studenta); posiadanie całej grupy zwiększa czynsz,
- rozbudowa pól aż do landmarku,
- **wykupienie pola** od innego gracza za 2× wartość (cena + budynki) po zapłaceniu czynszu (landmarku nie da się wykupić),
- zwycięstwo przez bankructwo przeciwników albo przez monopol (np. 3 pełne grupy kolorów).

**Własne dodatki:**
| Oryginał | Kampus Tour |
|---|---|
| Start | **Początek**: premia za przejście |
| Więzienie | **Kolokwium**: tracisz turę albo zdajesz rzutem dubletu |
| Mistrzostwa świata | **Juwenalia**: wybrane własne pole ma czynsz ×2, kolejne Juwenalia ×3, ×4… (jedno pole naraz) |
| Podróż | **Bilet MPK**: przeskok na dowolne pole w następnej turze |
| Karty szansy | **Karty Dziekanatu**: stypendium, warunek, poprawka itp. |

Do tego pole **Opłata za akademik** (15 zł) oraz Ksero i Stołówka (czynsz zależny od rzutu).

**Długość partii:** maksymalnie około 45 minut. Po 20 rundach wygrywa
gracz z największym majątkiem (gotówka + wartość pól i budynków). Limitu czasu partii nie ma.
Po partii ekran podsumowania (`KampusSummary.tsx`): wykres majątku, zapłacone czynsze, dochód z pól, dublety.

### 2.2 Poprawka (gra karciana typu Uno)

- 2–6 graczy, własne karty, nazwy i grafiki.
- Ukryte informacje: każdy widzi tylko swoją rękę (filtrowanie stanu per gracz).

### 2.3 Statki i Gomoku (pięć w rzędzie)

- Proste gry 1v1, zbudowane jako pierwsze, żeby przetestować cały przepływ platformy.
- Gomoku: plansza 15×15, wygrywa 5 lub więcej w linii; `id` gry to nadal `piec-w-rzedzie`.
- Statki również wymagają ukrywania stanu (plansza przeciwnika).
- Statki: cztery tryby do wyboru w lobby: Klasyczny (10×10, flota 1×4, 2×3, 3×2, 4×1 bez stykania, także rogami),
  Szybki (8×8, flota 4-3-2-2, partia na kilka minut),
  Amerykański (`hasbro`, 10×10, flota 5-4-3-3-2, statki mogą się stykać, bez X wokół zatopionego) i Flota wojenna (12×12, flota 6-5-4-4-3-3-2-2).
- Statki: losowe ustawienie
  na start z przenoszeniem (przeciąganie albo dotknięcie) i obracaniem, trafienie = kolejny strzał, X wokół zatopionego.
  Gotowość w rozstawianiu można cofnąć; całe rozstawianie ma jeden limit 90 s.

### 2.3a Chińczyk (spoza pierwotnego planu)

- 2-4 graczy, wyjście tylko na 6, 3 próby, gdy żaden pionek nie stoi na torze, 6 = kolejny rzut, max 3 szóstki z rzędu.
- Pole startowe z pionkiem właściciela jest bezpieczne (rywal nie może na nim stanąć); w domku końcowym nie wolno przeskakiwać własnych pionków.
- Dwa tryby w lobby: Klasyczny (jak wyżej, 4 pionki, pełny ranking, 60 s) i Szybki (pionek na starcie, wyjście na 1 i 6,
  nadwyżka oczek do domku przepada, dodatkowy rzut za zbicie i wejście do domku, koniec po pierwszym graczu z 3 pionkami, 20 s, szybsze animacje).
- Klasyczny toczy się do pełnego rankingu (`isOver` zwraca `ranking`). Jedyny możliwy ruch wykonuje się sam.

### 2.4 Mini-gry (przerywniki)

- **Refleks**: dotknij pola, gdy zmieni kolor; 30 s, wynik = liczba trafień (remis: niższa średnia reakcja), falstart kosztuje czas.
- **Sekwencja** (`simon`): powtarzanie rosnącej sekwencji 4 kolorów, wynik = najdłuższa seria.
- **Stoper**: licznik znika po 3 s, dotknij dokładnie przy wylosowanym celu (6-14 s); wynik = odchyłka w ms (mniej lepiej).
- **Tabela Schultego**: siatka 5×5 z liczbami 1-25, dotykasz po kolei; wynik = czas + 3 s za każdą pomyłkę.
  Tryby Klasyczna (liczby zostają widoczne) i Łatwa (znalezione gasną); postęp rywali widać w pigułkach graczy (ruch `progress`).
- **Kolor liter** (`stroop`): nazwa koloru napisana innym kolorem, wybierasz kolor liter; 30 s, wynik = trafienia (remis: niższa średnia).
- **Liczenie**: 30 s działań (+, −, ×, :) z czterema odpowiedziami; wynik jak w Kolorze liter.
  W obu pomyłka blokuje na 1 s (inaczej losowe klepanie byłoby szybsze niż myślenie).
- **Narysuj koło**: do 10 prób palcem, liczy się najlepsza (można zakończyć wcześniej), wynik = % idealności liczony na serwerze z punktów rysunku (dopasowanie okręgu, zakładka obcinana, poniżej 0,9 obrotu albo za małe = 0). Niedokończone koło nie zużywa próby; na końcu najlepsze i najgorsze koło każdego gracza.
- **Odcień** (`kolor`): 5 kolorów, każdy widać 2 s, potem odtwarzasz go suwakami barwy, nasycenia i jasności; wynik = suma odległości ΔE (Lab, każda ucięta do 100, mniej lepiej), liczona na serwerze.
- **Policz kropki**: 10 rund, w każdej 8-40 kropek widocznych przez 1,5 s, potem wpisujesz ich liczbę; wynik = suma błędów (mniej lepiej), liczona na serwerze. Po każdej odpowiedzi kropki wracają z prawdziwą liczbą i różnicą; numer rundy rywali widać w pigułkach graczy (ruch `progress`).
- **Środek**: 10 rund, w każdej odcinek pod losowym kątem, dotykasz jego środka; wynik = suma odległości w umownych px (pole ma bok 300 px niezależnie od telefonu, każda ucięta do 150, mniej lepiej), liczona na serwerze. Po dotknięciu przez 1 s widać prawdziwy środek i odległość.
- 1-6 graczy naraz, każdy gra u siebie to samo wyzwanie (wylosowane na serwerze), na końcu ranking.
  Partia toczy się na kliencie (opóźnienie Wi-Fi zepsułoby pomiar), serwer dostaje tylko wynik i odrzuca nierealne wartości.
- Każda mini-gra zaczyna od ekranu instrukcji (`Intro` w ui.tsx: animowany podgląd, trzy punkty z ikonami, „Start”). Każdy klika „Start” osobno i gra od razu;
  po 15 s (`INTRO_SECONDS`) gra rusza sama. Limit platformy startuje dopiero, gdy wystartuje ostatni gracz (wiadomość pokoju `begin`); na ekranie widać, kto już gra, a kto czyta zasady.
- Każda mini-gra ma jeden typ ruchu `result` (Narysuj koło wysyła go po każdej próbie, Tabela Schultego i Policz kropki mają jeszcze `progress`); ranking liczy wspólne `rankResults` (core.ts), zwycięzca tylko przy 2+ graczach bez remisu.
  Kolor liter i Liczenie dzielą `quiz.ts` i `Quiz.tsx`. Pasek statystyk w trakcie partii to wspólne `Stats` (ui.tsx). Odświeżenie w trakcie = partia od nowa.

### 2.5 Państwa-miasta

- 2-6 graczy, 5 rund, każda na inną literę (bez Ą Ć Ę Ń Ó Ś Ź Ż Q V X Y), kategorie: Państwo, Miasto, Zwierzę, Roślina, Rzecz, Imię.
- Wszyscy piszą naraz (90 s). Kto pierwszy odda kartkę (z kompletem albo bez), daje STOP i reszta ma jeszcze 7 s. Szkic leci na serwer w tle, więc po czasie albo odświeżeniu nic nie przepada.
- Głosowanie (45 s): odpowiedź odpada, gdy odrzuci ją ponad połowa pozostałych; zła pierwsza litera odpada sama.
- Punkty: 15 jedyna ważna w kategorii, 10 unikalna, 5 powtórzona (bez wielkości liter i polskich znaków), 0 brak lub odrzucona.
- Po głosowaniu podsumowanie rundy (20 s albo „Dalej” od wszystkich).
- Limit zależny od fazy: opcjonalne `turn(state) → { key, seconds }` w `GameDefinition`; licznik startuje od nowa tylko przy zmianie `key`.

## 3. Architektura

```
Telefon (PWA, React)  ⇄  WebSocket  ⇄  Serwer Colyseus (Node)
                                          │
                                          ├─ logika gier (czyste funkcje TS)
                                          └─ SQLite (na razie tylko ranking po nicku; stan pokoi w pamięci)
```

**Zasada:** serwer jest jedynym źródłem prawdy. Klient wysyła intencje („rzucam kośćmi”),
serwer je waliduje, losuje, liczy nowy stan i rozsyła każdemu graczowi jego widok.

### Interfejs gry

Każda gra to moduł niezależny od sieci i UI:

```ts
// packages/games/src/core.ts
interface GameDefinition<State, Move> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  moveSchema: z.ZodType<Move>;          // kształt ruchu z sieci; reguły sprawdza validateMove
  modes?: { id: string; name: string; hint: string; default?: boolean }[]; // tryby do wyboru w lobby
  setup(players: PlayerId[], rng: Rng, mode?: string): State;
  validateMove(state: State, player: PlayerId, move: Move): boolean;
  applyMove(state: State, player: PlayerId, move: Move, rng: Rng): State;
  playerView(state: State, player: PlayerId): unknown; // ukrywanie informacji; obserwator dostaje ""
  isOver(state: State): { winner?: PlayerId; ranking?: PlayerId[] } | null;
  waitingFor(state: State): PlayerId[]; // jedna osoba albo kilka w fazie równoczesnej; [] po końcu
  turnSeconds?: number;                 // limit tury
  turn?(state: State): { key: string; seconds: number }; // limit zależny od fazy, licznik od nowa przy zmianie key
  timeoutMove?(state: State, player: PlayerId, rng: Rng): Move;  // ruch za gracza po limicie
}
```

Rejestr gier: `GAMES` w `packages/games/src/index.ts`. Wiadomości pokoju: `ROOM_MESSAGES` w `lobby.ts`.
Wspólne pomocnicze w `core.ts`: `createRng` (mulberry32), `roomCode`, `rankResults`, `shuffle`, `average`, `byHitsThenAverage`.

### Reguły platformy (obowiązują każdą grę)

- Po limicie tury serwer wykonuje `timeoutMove` (losowy ruch), nie przegraną. Limit odnawia się tylko,
  gdy zmienia się `waitingFor` (albo `key` z `turn`) lub ten sam gracz ma kolejny ruch.
- Gracze bez miejsca oglądają partię. Nowy gracz dostaje miejsce sam, jeśli gra wybrana i jest wolne.
- Rewanż po zgodzie wszystkich grających, kolejność miejsc rotuje; do lobby może wrócić każdy.
- W mini-grach (gry solo, `minPlayers: 1`) limit rusza po ekranie instrukcji: gdy wszyscy klikną „Start” albo po 15 s.
- Limit tury: 60 s w większości gier; dłużej w Sekwencji (300 s), Tabeli Schultego i Odcieniu (180 s),
  Narysuj koło i Policz kropki (120 s), Kolorze liter i Liczeniu (90 s); Państwa-miasta mają limit per faza, Statki 90 s na całe rozstawianie, Chińczyk w trybie Szybkim 20 s.
- Gdy gracz z miejscem zniknie z pokoju w trakcie partii (wyjdzie sam albo nie wróci w 10 minut), partia się kończy:
  jeśli został jeden gracz, wygrywa walkowerem; przy większej liczbie kończy się bez zwycięzcy.
- Lobby: gospodarz wybiera grę (i tryb, jeśli gra ma `modes`; zmiana trybu kasuje gotowość gości) i daje start, goście potwierdzają gotowość; każdy może zmienić swój kolor
  (poza partią); link `/?kod=ABCD` z przyciskiem udostępniania.
- Limit 3 pokoi na IP, rate limit 10 wiadomości/s na klienta.

**Platforma (skorupa)** jest wspólna dla wszystkich gier: pokoje z 4-znakowym kodem
(bez mylących znaków typu O/0, I/1), lobby z wyborem gry, nicki i kolory graczy,
reconnect, tablica wyników, rewanż, sprzątanie pokoi po godzinie bezczynności.

**Synchronizacja:** stan gry to zwykły obiekt TS. Po każdym ruchu serwer wysyła wiadomość
z `playerView` osobno do każdego gracza, zamiast pełnej synchronizacji Schema z Colyseus.
Prościej i bezpiecznie dla gier z ukrytymi informacjami.

## 4. Stack

| Warstwa | Technologia |
|---|---|
| Język | TypeScript (wszędzie) |
| Monorepo | pnpm workspaces |
| Serwer / pokoje | Colyseus (Node.js) + Express (statyczny frontend, `/api/stats`) |
| Walidacja wiadomości | zod |
| Frontend | Vite + React |
| Style / animacje | Tailwind, Motion (planowane, jeszcze niezainstalowane; na razie animacje w CSS) |
| Ikony | Phosphor Icons |
| Plansza | SVG / CSS Grid |
| PWA | manifest + ikony, bez service workera (gra i tak wymaga serwera) |
| Trwałość stanu | SQLite (wbudowany `node:sqlite`) |
| Testy | Vitest (szczególnie zasady Kampus Tour) |
| CI/CD | GitHub Actions → obraz Dockera |

## 5. Struktura repozytorium

```
mini-games/
├─ packages/
│  └─ games/src/   # core.ts (kontrakt, RNG, utilsy), lobby.ts, index.ts (GAMES),
│                  # <gra>.ts + <gra>.test.ts dla każdej gry (płasko)
├─ apps/
│  ├─ server/src/  # index.ts, LobbyRoom.ts (pokój Colyseus), stats.ts + stats.test.ts (SQLite, GET /api/stats)
│  └─ web/src/     # main.tsx, App.tsx, net.ts (połączenie, token, reconnect), Dev.tsx (tryb testowy),
│                  # screens/ (Home, Lobby, Game, ui.tsx ze wspólnymi Screen/StickyBar/Scores),
│                  # games/<Gra>.tsx (UI każdej gry), index.css (klasy .tile .label .btn .field)
├─ .github/workflows/ci.yml
├─ Dockerfile, docker-compose.yml, cloudflared/
├─ README.md      # dev i deploy
├─ ZASADY-GIER.md # dokładne zasady każdej gry (czytaj przed zmianą gry, aktualizuj po zmianie zasad)
└─ KONCEPT.md
```

Dokładne zasady gier: `ZASADY-GIER.md` (przeczytaj sekcję gry przed zmianą, popraw po zmianie zasad).

Proces wprowadzania nowej gry (ustalenia, testy przed kodem, spójność zasad, wyglądu i animacji): `ZASADY.md`.

Nowa gra = sekcja w `ZASADY-GIER.md`, plik zasad z testami w `packages/games/src`, wpis w `GAMES`, komponent w `apps/web/src/games`,
podpięcie w `screens/Game.tsx` i ikona w `screens/Lobby.tsx`.

## 6. Hosting

- **Raspberry Pi** w homelabie, kontener Docker obok istniejących usług.
- **Cloudflare Tunnel** (`cloudflared`) wystawia `games.figielak.dev` bez otwierania portów; obsługuje WebSockety.
- Jeden kontener serwuje zbudowany frontend i WebSockety.
- `mem_limit: 256m` w docker-compose, żeby gry nie zagroziły innym usługom.
  Spodziewane zużycie: ~100–150 MB RAM przy kilku pokojach.
- SQLite w wolumenie Dockera, objęty istniejącym backupem homelaba.
- Plan B: ten sam obraz na Cloud Run (`max-instances=1`, timeout 60 min, SQLite → Firestore).

## 7. Bezpieczeństwo i fair play

- Rzuty kośćmi i tasowanie kart tylko na serwerze.
- Walidacja każdego ruchu (czy to tura gracza, czy ruch jest dozwolony, czy stać go na zakup).
- Rate limiting wiadomości i limit liczby pokoi na IP.
- Brak danych osobowych: tylko nick i losowy token sesji.

## 8. Plan prac

| Etap | Zakres | Cel |
|---|---|---|
| 0 | Monorepo, Docker, tunnel, „hello world” pod subdomeną | Infrastruktura działa (gotowe) |
| 1 | Skorupa: pokoje, kody, lobby, nicki, reconnect | Platforma (gotowe) |
| 2 | Gomoku | Pierwsza gra end-to-end, rewanż (gotowe) |
| 3 | Statki | Ukrywanie stanu (`playerView`) (gotowe) |
| 4 | Kampus Tour: rdzeń (ruch, kupno, czynsz, budowanie, bankructwo) | Grywalna wersja główna (gotowe) |
| 5 | Kampus Tour: dodatki (Kolokwium, Juwenalia, karty, wykupienie, Bilet MPK, monopol) | Pełna wersja (gotowe) |
| 6 | Poprawka | Gra karciana (do zrobienia) |
| 7 | PWA, animacje, statystyki, szlify | Polerka (PWA i ranking po nicku gotowe) |
| + | Chińczyk, mini-gry (10 sztuk), Państwa-miasta | Poza planem (gotowe) |
| dalej | Zapis stanu pokoi w SQLite | Do zrobienia |

## 8a. Sposób pracy

- Plan (plan mode) → akceptacja użytkownika → implementacja.
- TDD: testy zasad gry (`<gra>.test.ts`, Vitest) w osobnym commicie przed implementacją.
- Styl UI: tokeny 1:1 z `../figielak.dev/src/styles/tokens.css` (akcent #ff2445, Satoshi + Geist Mono,
  przyciski pill), tylko ciemny motyw, zero em-dashy w tekstach UI, kolor gracza zamiast czerwieni dla jego akcji.
- `apps/server` nie może mieć bezpośredniej zależności `zod` (druga kopia `@colyseus/core` → „seat reservation expired”);
  schematy trzymamy w `packages/games`.
- Tryb testowy: `/dev` na serwerze Vite pokazuje kilku graczy obok siebie w jednym pokoju (`/dev?n=4`, domyślnie 2);
  każda ramka to `/?dev=N` z własnym tokenem i nickiem. Działa tylko w dev, w buildzie go nie ma.
- Dev serwer działa z `node --watch`: po zmianie w `apps/server` albo `packages/games` restartuje się sam
  (pokoje są w pamięci, więc trwające partie przepadają).

## 9. Otwarte kwestie

- Nazwy pól Kampus Tour ustalone (grupy jako pory dnia studenta, Ksero i Stołówka jak wodociągi); druga nazwa w grupie „Rano” robocza (Automat z przekąskami).
- Balans ekonomii: start 200 zł (+20 zł za każde dalsze miejsce), kieszonkowe 40 zł, czynsz P/10 (cała grupa x2), z budynkami 0,4P / P / 2P / 4P; bez kompletu grupy do poziomu 2 (poziom 3 i landmark z kompletem), jazda Biletem MPK bez kieszonkowego. Zmiany po 4 partiach testowych (2026-10-07): poziom 3 od pierwszej tury i czynsze 60-100 zł przy pustych kieszeniach dawały szybkie bankructwa, a MPK zamieniał się w darmowy komplet. Do sprawdzenia w kolejnych partiach; jeśli monopol dalej będzie łatwy przez grupy dwupolowe, liczyć tylko grupy trzypolowe.
- Zestaw kart specjalnych w Poprawce (talia 18 Kart Dziekanatu ustalona, w kodzie: CARDS w kampus-tour.ts).
- Własna nazwa całej platformy.