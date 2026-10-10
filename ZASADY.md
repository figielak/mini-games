# Jak wprowadzać nową grę

Kolejność jest stała: **ustalenia → testy zasad → kod zasad → ekran → podpięcie**. Każdy krok to osobny commit.
Ten plik opisuje proces i to, co ma być wspólne dla wszystkich gier. Zasady konkretnych gier są w `ZASADY-GIER.md`,
architektura i reguły platformy w `KONCEPT.md` (sekcja 3).

## 1. Co ustalić, zanim powstanie jakikolwiek plik

Wynikiem tego kroku jest nowa sekcja w `ZASADY-GIER.md` i wiersz w jej tabeli. Dopóki któryś punkt jest niejasny,
nie piszemy testów.

**Tożsamość**
- `id` (małe litery, myślniki). Jest kluczem rankingu w SQLite, więc **nie zmienia się nigdy**, nawet gdy zmieni się nazwa w UI.
- Nazwa w UI: krótka, jedno lub dwa słowa, mieści się na kaflu w lobby.
- Liczba graczy (`minPlayers`, `maxPlayers`). `minPlayers: 1` oznacza grę z grupy „Szybkie i refleksowe”.
- Tryby (opcjonalnie, tylko gry główne; mini-gra ma zasady narzucone z góry): lista `modes` z `id`, nazwą i jednolinijkowym opisem, w kolejności wyświetlania; domyślny ma `default: true`. Tryb zmienia liczby
  (plansza, flota, flagi zasad), nie mechanikę; wszystkie tryby liczą się do jednego rankingu (wzór: `statki.ts`).

**Typ gry** (decyduje o całej reszcie)

| Typ | Kto rusza | Gdzie toczy się partia | Wzorzec do skopiowania |
|---|---|---|---|
| po kolei | jedna osoba w `waitingFor` | serwer | `piec-w-rzedzie.ts`, `chinczyk.ts` |
| ukryty stan | jedna lub obie | serwer, `playerView` filtruje | `statki.ts` |
| równoczesna z fazami | kilka osób naraz | serwer, `turn()` z kluczem fazy | `panstwa-miasta.ts` |
| mini-gra | wszyscy naraz, każdy u siebie | klient, serwer dostaje jeden `result` | `stoper.ts` |

**Zasady**
- Przebieg tury i wszystkie ruchy (lista wariantów `Move`).
- Koniec gry: kiedy następuje, kto wygrywa, co przy remisie, czy jest pełny ranking, czy tylko zwycięzca.
- Co jest losowe i kiedy jest losowane (zawsze na serwerze, z `rng`).
- Co jest ukryte przed kim, i co widzi obserwator.
- Limit tury w sekundach oraz co dokładnie robi `timeoutMove` w każdej fazie.
- Dla mini-gry: jednostka wyniku, kierunek (mniej czy więcej lepiej), rozstrzyganie remisu,
  zakres wartości możliwych do uzyskania (serwer odrzuca resztę) i najgorszy wynik po limicie czasu.
- Wszystkie liczby (rozmiar planszy, liczba rund, czasy, kary) jako nazwane stałe, bez „około”.

**Ekran**
- Pion czy poziom. Poziom tylko wtedy, gdy plansza naprawdę nie mieści się w pionie (dziś wyłącznie Kampus Tour, klasa `.landscape`).
- Co gracz widzi, gdy czeka na innych, i co widzi obserwator.
- Co pokazuje ekran końcowy poza rankingiem.

## 2. Testy przed kodem

Plik `packages/games/src/<id>.test.ts` powstaje i jest commitowany **przed** `<id>.ts`
(commit „<Gra>: testy zasad”, potem „<Gra>: zasady (...)”, potem ekran). W chwili commitu testy nie przechodzą
i tak ma być. Kod zasad jest gotowy, gdy przechodzą wszystkie, bez zmieniania testów pod implementację.
Jeśli w trakcie okaże się, że zasada była źle pomyślana, najpierw zmienia się test i `ZASADY-GIER.md`, potem kod.

Nagłówek pliku to komentarz z listą zasad, które testy ustalają (wzór: `stoper.test.ts`).

### Testy obowiązkowe w każdej grze

- **Definicja**: `minPlayers`, `maxPlayers`, `turnSeconds` albo `turn()`; świeża gra nie jest skończona.
- **Setup**: stan początkowy, kto zaczyna (`waitingFor`), dwa różne seedy dają różne losowania, ten sam seed to samo.
- **Walidacja**, każdy przypadek osobno:
  - gracz spoza gry,
  - ruch poza swoją turą albo w złej fazie,
  - ruch poprawny w kształcie, ale niedozwolony (zajęte pole, za mało pieniędzy, drugi wynik),
  - ruch po końcu gry,
  - wartości brzegowe: pierwsza i ostatnia dozwolona przechodzą, sąsiednie nie.
- **Schemat**: `moveSchema` odrzuca śmieci z sieci (zły typ, brak pola, za długi tekst, liczba niecałkowita).
- **Każda zasada z sekcji w `ZASADY-GIER.md`** ma co najmniej jeden test nazwany tak, jak brzmi zasada.
- **Koniec gry**: wygrana każdego gracza (nie tylko pierwszego), remis, ranking w dobrej kolejności, `waitingFor` puste po końcu.
- **Limit czasu**: `timeoutMove` w każdej fazie zwraca ruch, który przechodzi `validateMove`.
- **Stan**: `applyMove` nie zmienia poprzedniego obiektu; stan przeżywa `JSON.parse(JSON.stringify(...))`.

### Testy zależne od typu

- **Ukryty stan**: `playerView` dla gracza nie zawiera danych przeciwnika, w każdej fazie; widok obserwatora (`""`)
  nie zawiera danych żadnej strony; po odsłonięciu widać dokładnie to, co odsłonięte.
- **Fazy równoczesne**: `waitingFor` kurczy się po kolei, `turn().key` zmienia się tylko przy zmianie fazy,
  minimalna i maksymalna liczba graczy (progi głosowań, większość przy 2 osobach).
- **Mini-gra**: wynik poza zakresem i wynik niecałkowity odpadają, drugi wynik odpada, remis nie daje zwycięzcy,
  gra solo kończy się rankingiem bez zwycięzcy, rewanż daje inne wyzwanie. Jeśli wynik liczy serwer z surowych danych
  (`kolo`, `kolor`, `kropki`), testowana jest funkcja licząca, także na danych zepsutych.

### Jak pisać

- Gracze to stałe `A`, `B`, `C` z imionami, RNG to `createRng(seed)`.
- Pomocnik `send(state, player, move)` sprawdza `validateMove`, potem woła `applyMove` (wzór w każdym pliku testów).
- Nazwy testów po polsku, opisują zasadę, nie funkcję („trafienie daje kolejny strzał”).
- Stan do testu buduje się ruchami albo małym pomocnikiem, nie ręcznie wpisanym obiektem, żeby test nie zależał od kształtu `State`.

## 3. Spójność zasad między grami

Te rzeczy działają tak samo w każdej grze. Odstępstwo wymaga wpisu w `ZASADY-GIER.md` z powodem.

- **Po limicie tury jest ruch, nie przegrana.** `timeoutMove` wybiera ruch neutralny albo losowy dozwolony;
  w mini-grze jest to najgorszy możliwy wynik.
- **Remis nie ma zwycięzcy.** `isOver` zwraca wtedy samo `ranking`. Mini-gry używają `ranked` (czyli `rankResults` i `places` z jednego komparatora) i nie liczą remisu ani gry solo do statystyk;
  bez `places` mini-gra nie przejdzie testu kontraktu, bo turniej liczy z niego punkty.
- **Kto zaczyna**: pierwszy z `players`. Kolejność miejsc rotuje platforma przy rewanżu, gra nie losuje startu sama.
- **Losowość tylko z `rng`** przekazanego do `setup` i `applyMove`. Żadnego `Math.random` ani `Date.now` w zasadach.
- **Stan to zwykły obiekt** dający się zapisać do JSON, a `applyMove` zwraca nowy.
- **`validateMove` jest jedynym strażnikiem.** Ekran może blokować przyciski, ale serwer niczego nie zakłada.
- **Mini-gra ma jeden ruch `result`** i pole odróżniające partie (wyzwanie albo `nonce`), po którym ekran montuje się od nowa przy rewanżu.
- **Kara za pomyłkę w grach na czas** to blokada 1 s albo doliczony czas, nigdy koniec partii (inaczej losowe klepanie wygrywa albo jedna pomyłka psuje zabawę).
- **Wspólne funkcje z `core.ts`** zamiast własnych: `shuffle`, `rankResults`, `ranked`, `average`, `byHitsThenAverage`.
  Dwie gry o tej samej mechanice dzielą moduł (jak `quiz.ts` dla Kolorów i Liczenia).
- **Limity tury**: 60 s na ruch w grach po kolei; w mini-grze tyle, ile trwa najdłuższa uczciwa partia plus zapas.
- **Obserwator** dostaje widok dla `""` i zawsze widzi coś sensownego.

## 4. Spójność wyglądu

Ekran gry to jeden plik `apps/web/src/games/<Gra>.tsx`. Dostaje `view`, `me`, `players`, `onMove`
(oraz `canMove` albo `ranking`) i nie wie nic o sieci.

**Czego gra nie rysuje sama**
- Nagłówek ze statusem („Twój ruch!”, „Czekamy na: ...”, „Wygrywasz!”), pasek czasu, lista graczy z liczbą wygranych partii (puchar przed liczbą, „+1” nad pigułką zwycięzcy),
  „Oglądasz”, komunikat o rozłączeniu, przyciski „Rewanż” i „Do lobby”. To wszystko daje `screens/Game.tsx`.
- Własny nagłówek ma tylko gra, której wspólny nie wystarcza (Państwa-miasta, Kampus Tour), i wtedy przejmuje cały jego zakres.

**Z czego gra się składa**
- Układ: `Screen` (jedna kolumna, `max-w-md`), akcje przy dolnej krawędzi, przy długiej treści `StickyBar`.
- Klasy z `index.css`: `.tile` (karta), `.label` (podpis), `.btn` + `.btn-primary` / `.btn-ghost`, `.field`.
  Nowa klasa wspólna powstaje dopiero, gdy potrzebuje jej druga gra.
- Wyniki mini-gry: komponent `Scores`, wiersz na gracza, „gra…” dopóki nie oddał.
- Kolory tylko z tokenów (`bg`, `surface`, `line`, `fg`, `fg-muted`, `accent`, `warning`, `success`), zaokrąglenia 20 px (kafel) i 10 px (wnętrze).
- Liczby, czasy i kody czcionką mono z `tabular-nums`.
- Ikony z `@phosphor-icons/react`; ikona gry w lobby ma wagę `regular`.

**Reguły**
- **Kolor gracza, nie czerwień**, dla wszystkiego, co jest „moje” lub „czyjeś”: pionki, kamienie, podświetlenie mojej tury.
  Czerwień akcentu zostaje dla głównego przycisku i ostrzeżeń (`warning` na ostatnie 10 s).
- Mini-gra zaczyna od ekranu instrukcji: komponent `Intro` (ui.tsx) z animowanym podglądem gry (mały komponent `Preview` w pliku gry,
  sama animacja CSS w pętli), trzema krótkimi punktami (`time`: czas, `task`: co zrobić, `score`: jak liczone są punkty) i przyciskiem „Start”.
  Limit gry jeszcze wtedy nie tyka; po `INTRO_SECONDS` (15 s) gra rusza sama. Pod przyciskiem widać, kto już gra, a kto czyta zasady.
- Pola dotykowe co najmniej 48 px (tyle ma `.btn`), a pola gry na czas mają `touch-none select-none` i reagują na `onPointerDown`.
- Ekran mieści się na 360×640 bez poziomego przewijania; plansza skaluje się do szerokości, nie ma stałych pikseli.
- Teksty po polsku, krótkie, bez em-dashy, przecinek dziesiętny („10,00 s”), te same słowa co w innych grach
  („Start”, „Dalej”, „Rewanż”, „Do lobby”, „(ty)”).
- Elementy ozdobne mają `aria-hidden`, a przyciski bez tekstu `aria-label`.
- Tylko ciemny motyw.

## 5. Spójność animacji i wibracji

Animacja ma pokazać, **co się właśnie stało**, a nie ozdabiać. Stan zawsze przychodzi z serwera od razu,
animacja tylko go dogania na ekranie.

- **Mechanizm**: keyframes w `index.css` z komentarzem, do czego służą, użyte przez `animate-[nazwa_czas_easing]`.
  Zmiany stanu (kolor, obwódka) przez `transition-colors`. Nowej biblioteki nie dodajemy.
- **Najpierw istniejące**: `stone-pop` (coś pojawia się na planszy), `ring-pulse` (to można wybrać),
  `dice-tumble` (rzut kośćmi), `card-in` (karta lub okno na środku), `float-up` (zmiana liczby), `set-glow` (świeże osiągnięcie),
  `preview-half` i `preview-quarter` (podgląd na ekranie instrukcji; kolejność ustawia ujemny `animation-delay`).
  Ta sama sytuacja w nowej grze używa tej samej animacji.
- **Czasy**:

  | Co | Czas |
  |---|---|
  | reakcja na dotyk (kolor, podświetlenie) | 100 ms |
  | przycisk, przejście stanu | 180 ms |
  | krok pionka po planszy | 180-220 ms na pole |
  | pojawienie się elementu lub karty | 350 ms, `ease-out` |
  | rzut kośćmi | 700 ms |
  | pływająca liczba | 1,6 s |

- **Animacja nie blokuje gry.** Przyciski działają w trakcie, kolejny stan z serwera przerywa poprzednią animację,
  a przy dużym skoku (odświeżenie, powrót do karty) element od razu ląduje na miejscu.
  Wyjątek: Statki po pudle trzymają stary układ plansz przez 1,2 s (`SWAP_MS`), zanim plansze się zamienią i pojawi się
  przycisk strzału; bez tego broniący nie widział, gdzie padł strzał.
- **Kroki sekwencyjne** (pionek idzie pole po polu) to stan „pokazywany” goniący stan „docelowy” w `setTimeout`,
  ze stałymi `STEP_MS` i `ROLL_MS` na górze pliku (wzór: `Chinczyk.tsx`).
- **`prefers-reduced-motion`**: reguła globalna w `index.css` wyłącza animacje CSS, a każda animacja sterowana z JS
  sprawdza `reducedMotion` i przeskakuje do stanu końcowego.
- **Pomiar czasu nigdy nie zależy od animacji.** W grach na refleks bodziec pojawia się bez przejścia.
- **Wibracje zamiast dźwięku**, zawsze `navigator.vibrate?.(...)`:

  | Zdarzenie | Wzór |
  |---|---|
  | moja tura (robi to `Game.tsx`, gra tego nie powtarza) | 40 |
  | pomyłka | 60 |
  | coś złego dla mnie od innego gracza (zbity pionek) | [60, 40, 60] |

  Poprawne trafienie nie wibruje.

## 6. Podpięcie i odbiór

Podpięcie, w tej kolejności:
1. sekcja i wiersz tabeli w `ZASADY-GIER.md` (krok 1),
2. `packages/games/src/<id>.test.ts` (krok 2),
3. `packages/games/src/<id>.ts`, wpis w `GAMES` i eksport typu `View` oraz stałych w `index.ts`,
4. `apps/web/src/games/<Gra>.tsx`,
5. gałąź w `screens/Game.tsx` (mini-gra: `key` z wyzwania i wpis w `MINI_GAMES`), ikona w `ICONS` w `screens/Lobby.tsx`,
6. opis w `KONCEPT.md` (sekcja 2 i tabela etapów).

Po zmianie w `packages/games` serwer deweloperski trzeba zrestartować.

Gra jest gotowa, gdy w `/dev` (`/dev?n=...` dla większej liczby graczy) przeszło wszystko poniżej:
- [ ] `pnpm test` i `pnpm typecheck` bez błędów,
- [ ] pełna partia przy minimalnej i maksymalnej liczbie graczy, plus jeden obserwator,
- [ ] odświeżenie strony w każdej fazie,
- [ ] dobiegnięcie limitu tury w każdej fazie,
- [ ] wyjście gracza w trakcie (walkower),
- [ ] remis, rewanż i powrót do lobby,
- [ ] wynik w rankingu na stronie głównej,
- [ ] ekran 360×640, w wiadomościach WebSocket nie ma ukrytych danych,
- [ ] punkty z sekcji 3, 4 i 5 tego pliku.
