# Zasady gier

Opis zasad tak, jak działają w kodzie (`packages/games/src/<id>.ts`). Przeczytaj sekcję gry, zanim ją zmienisz;
po zmianie zasad popraw też ten plik. Źródłem prawdy jest kod i testy (`<id>.test.ts`), tu jest skrót.
Reguły platformy (limit tury, rewanż, walkower, obserwatorzy) są w `KONCEPT.md`, sekcja 3.

| Nazwa w UI | `id` / plik | Gracze | Limit tury | Typ |
|---|---|---|---|---|
| Kampus Tour | `kampus-tour` | 2-4 | 60 s | planszowa, po kolei |
| Chińczyk | `chinczyk` | 2-4 | 60 s (Szybki 20 s) | planszowa, po kolei |
| Statki | `statki` | 2 | 90 s rozstawianie, 60 s strzał | ukryty stan |
| Gomoku | `piec-w-rzedzie` | 2 | 60 s | po kolei |
| Memory | `memory` | 2-6 | 60 s | po kolei, ukryty stan |
| Państwa-miasta | `panstwa-miasta` | 2-6 | zależny od fazy | równoczesna |
| Refleks | `refleks` | 1-6 | 60 s | mini-gra |
| Sekwencja | `simon` | 1-6 | 300 s | mini-gra |
| Stoper | `stoper` | 1-6 | 60 s | mini-gra |
| Tabela Schultego | `schulte` | 1-6 | 180 s | mini-gra |
| Kolor liter | `stroop` | 1-6 | 90 s | mini-gra |
| Liczenie | `liczenie` | 1-6 | 90 s | mini-gra |
| Narysuj koło | `kolo` | 1-6 | 120 s | mini-gra |
| Odcień | `kolor` | 1-6 | 180 s | mini-gra |
| Policz kropki | `kropki` | 1-6 | 120 s | mini-gra |
| Który rok? | `rok` | 1-6 | 240 s | mini-gra |
| Środek | `srodek` | 1-6 | 60 s | mini-gra |
| Stój! | `stoj` | 1-6 | 60 s | mini-gra |
| Śledzenie | `sledzenie` | 1-6 | 300 s | mini-gra |
| Wieża | `wieza` | 1-6 | 180 s | mini-gra |
| Rytm | `rytm` | 1-6 | 60 s | mini-gra |
| Inny element | `inny` | 1-6 | 90 s | mini-gra |

Nazwy w UI zmieniały się (2026-10-10), `id`, nazwy plików i typów zostały stare: Sekwencja = `simon`, Kolor liter = `stroop`,
Odcień = `kolor`, Gomoku = `piec-w-rzedzie`. Ranking w SQLite jest po `id`, więc `id` nie wolno zmieniać.

## 1. Mini-gry (wspólny schemat)

- Wyzwanie losuje serwer w `setup` (to samo dla wszystkich) i od razu wysyła w widoku. `playerView` zwraca cały stan,
  więc nic nie jest ukryte (da się podejrzeć; świadoma decyzja, komentarze `ponytail:`).
- Partia toczy się na kliencie. Każdy gracz wysyła jeden ruch `{ type: "result", ... }`; drugi ruch tego samego gracza jest odrzucany.
  Wyjątki: Narysuj koło (do 10 ruchów na gracza), Tabela Schultego, Policz kropki, Który rok? i Wieża (dodatkowy ruch `progress` po każdym trafieniu, rundzie albo klocku).
- Serwer odrzuca tylko nierealne wartości. Wynik liczy serwer tam, gdzie się da (Narysuj koło, Odcień, Policz kropki, Który rok?, Środek, Stój!, Śledzenie, Wieża, Rytm),
  w reszcie ufa klientowi.
- Partia zaczyna się ekranem instrukcji (platforma, nie zasady gry): każdy klika „Start” osobno (wiadomość pokoju `begin`) i gra od razu,
  po `INTRO_SECONDS` (15 s) gra rusza sama. Limit tury startuje, gdy wystartują wszyscy albo minie 15 s; wynik oddany wcześniej go nie uruchamia.
- `waitingFor` = gracze bez wyniku. Po limicie `timeoutMove` wpisuje najgorszy możliwy wynik.
- Koniec, gdy wszyscy oddali wynik. Ranking liczy `rankResults` (core.ts): zwycięzca tylko przy 2+ graczach i bez remisu
  na pierwszym miejscu; gra solo nie ma zwycięzcy (nie nabija statystyk).
- Odświeżenie strony w trakcie = partia od nowa na kliencie. `nonce` w stanie (Stoper, Narysuj koło, Rytm) służy tylko do tego,
  żeby rewanż zamontował komponent od nowa.

### Refleks (`refleks`)
- 30 s. Pole zmienia kolor po losowym opóźnieniu 1-3 s (31 opóźnień z serwera), gracz dotyka jak najszybciej.
- Wynik: `times` (czasy reakcji trafień) i `falseStarts`. Więcej trafień wygrywa, przy remisie niższa średnia (`byHitsThenAverage`).
  `falseStarts` nie wpływa na ranking; falstart kosztuje czas na kliencie.
- Walidacja: każdy czas 100-5000 ms, suma ≤ 30 s. Limit czasu: zero trafień.

### Sekwencja (`simon`)
- Sekwencja 100 kolorów (0-3). Klient pokazuje pierwsze n, gracz powtarza, potem n+1 itd. (pole świeci 450 ms, przerwa 150 ms).
- Wynik: `score` = najdłuższa powtórzona seria, więcej lepiej. Walidacja: 0-100. Limit czasu: 0.

### Stoper (`stoper`)
- Po „Start” odliczanie 3, 2, 1 (dotknięcia ignorowane), potem licznik biegnie od 0, po 3 s znika, gracz dotyka przy celu. Klient sam kończy po dwukrotności celu.
- Cel (`target`) losuje serwer: pełne sekundy 6-14 s, ten sam dla wszystkich w partii.
- Grający nie widzi limitu tury po starcie (tykający pasek zdradzałby czas); po dotknięciu: odkryty czas i odchyłka ze znakiem.
- Wynik: `deviation` = odchyłka w ms (int, od 0 do celu), mniej lepiej. Limit czasu: odchyłka równa celowi.

### Tabela Schultego (`schulte`)
- Siatka 5×5 z liczbami 1-25 w losowym układzie, dotykasz po kolei od 1.
- Wynik: `ms` + 3000 ms za każdą pomyłkę (`total`), mniej lepiej.
- Walidacja: `ms` od 3750 (25 × 150 ms) do 180000, `mistakes` int ≥ 0. Limit czasu: 180000 ms, 0 pomyłek.
- Międzyczasy: wynik niesie `splits`, czyli 25 czasów szukania kolejnych liczb (int ≥ 0 ms, suma równa `ms`).
  Pusta lista jest dozwolona (limit czasu). Nie wpływają na ranking, służą tylko do ekranu końcowego.
- Ekran końcowy: pod tabelą wyników wiersz z przewagą („Gracz 1 wygrywa o 0,3 s”, tylko gdy jest zwycięzca) i wykres międzyczasów
  (linia na gracza w jego kolorze, kropka na najdłużej szukanej liczbie, w legendzie „najdłużej 17 (4,1 s)”).
- Tryby: **Klasyczna** (domyślna; znalezione liczby zostają widoczne, jak w oryginale) i **Łatwa** (`latwa`; znalezione gasną).
  Tryb zmienia tylko wygląd, zasady i ranking są wspólne. Dotknięcie już znalezionej liczby nic nie robi w obu trybach.
- Postęp rywali: po każdym trafieniu (poza ostatnim) klient wysyła `{ type: "progress", found }` (int 1-24, tylko gracz bez wyniku).
  Serwer zapisuje go w `progress` i pokazuje w pigułkach graczy jako pasek i `12/25`. Wartość nie musi rosnąć
  (po odświeżeniu gracz zaczyna od 1) i nie wpływa na wynik.
- Limit przez `turn()` ze stałym kluczem: ruch `progress` nie odnawia 180 s, nawet gdy gra już tylko jedna osoba.
- Ekran: trafiony kafelek błyska na zielono, pomyłka na czerwono z potrząśnięciem; lokalny zegar ma etykietę „Twój czas”.

### Kolor liter (`stroop`) i Liczenie (`liczenie`)
Wspólne zasady w `quiz.ts`, wspólny ekran `Quiz.tsx` (dzieli je też Inny element).
- 30 s pytań z czterema odpowiedziami; serwer losuje 200 pytań (starczy przy 150 ms na odpowiedź).
- Pomyłka blokuje na 1 s (inaczej losowe klepanie byłoby szybsze niż myślenie).
- Wynik: `times` (czasy poprawnych) i `errors`. Ranking jak w Refleksie: trafienia, potem niższa średnia. `errors` nie wpływa na ranking, ale jest widoczne w pasku statystyk i w wynikach.
- Ekran końcowy: tabela z miejscem (puchar u zwycięzcy), trafieniami, średnim czasem (od 1 s w sekundach) i błędami; pod nią notka, jak liczony jest ranking.
- Dotknięta odpowiedź błyska: zielono przy trafieniu, czerwono z potrząśnięciem przy pomyłce.
- Walidacja: każdy czas 150-5000 ms, suma ≤ 30 s, najwyżej 200 czasów. Limit czasu: zero trafień.
- **Kolor liter**: nazwa koloru (CZERWONY, NIEBIESKI, ŻÓŁTY, ZIELONY) napisana kolorem liter; odpowiedź to kolor liter, nie słowo.
  W 25% plansz słowo zgadza się z kolorem (żeby nie dało się grać „zawsze inny”).
- **Liczenie**: działania losowane po równo z czterech typów: `a + b` (10-99), `a − b` (a 20-99, b 10-a, wynik ≥ 0),
  `a × b` (2-9 × 2-12), `a : b` (dzielnik 2-9, wynik 2-12, zawsze bez reszty). Złe odpowiedzi to typowe pomyłki
  blisko poprawnej: ±1, ±2, ±10, ±20 przy dodawaniu i odejmowaniu, ±1, ±2, ±a, ±b przy mnożeniu, ±1, ±2, ±3 przy dzieleniu;
  dodatnie i bez powtórek. Liczby z działania nie ma wśród opcji: działanie z wynikiem równym `a` albo `b` (49 : 7) jest losowane od nowa.

### Narysuj koło (`kolo`)
- Limit przez `turn(state)`: 120 s na wszystkie próby gracza (także solo); licznik rusza od nowa tylko, gdy ktoś skończy próby.
- Do 10 prób palcem, liczy się najlepsza. Punkty rysunku w układzie 0-1 względem kwadratowego płótna.
- Na środku płótna jest mała kropka (pomoc w wyobrażeniu sobie koła); ocena nie zależy od położenia rysunku.
- Każda próba to osobny ruch `result` z `points` (20-1000 punktów, wszystkie w 0-1). Pusta lista kończy pozostałe próby
  (zostaje dotychczasowa najlepsza); to też ruch po limicie czasu.
- Ocenę liczy serwer (`judge`), klient woła tę samą funkcję przed wysłaniem i niedokończonego koła nie wysyła, więc nie zużywa próby.
- `judge`: obcina rysunek po pełnym obrocie (zakładka nie liczy się), dopasowuje okrąg (metoda Kåsy), potem:
  - poniżej 0,9 obrotu albo mniej niż 20 punktów: `unfinished`, 0 pkt,
  - promień poniżej 0,15: `small`, 0 pkt,
  - inaczej `score = 1000 × (1 − 4 × średni błąd promienia / r)² × (1 − przerwa)`, gdzie przerwa między początkiem
    a końcem liczona w częściach obwodu, pierwsze 3% za darmo.
- `judge` zwraca też dopasowany okrąg (`circle`). Po próbie klient pokazuje go przerywaną linią, rysunek koloruje według
  odchylenia od niego (zielony blisko, czerwony od 10% promienia), a na środku płótna wynik z porównaniem do najlepszej próby.
- Wynik 0-1000 (dziesiąte części procenta), więcej lepiej. Stan trzyma `best` i `worst` każdego gracza.
- Ekran końcowy: karta na gracza w kolejności rankingu (nick, duży najlepszy wynik), pod nią miniatury „Najlepsza” (z przerywanym idealnym okręgiem) i „Najgorsza”; bez osobnej tabeli wyników.
- Koniec, gdy każdy ma 10 prób.

### Odcień (`kolor`)
- 5 kolorów HSB; każdy widać 2 s, potem gracz odtwarza go suwakami barwy (0-359), nasycenia i jasności (0-100).
- Cele losowane bez prawie szarych i prawie czarnych: nasycenie 25-100, jasność 30-100.
- Jeden ruch z 5 kolorami (wszystkie składowe int). Wynik liczy serwer: suma ΔE (CIE76 w Lab), każda ucięta do 100,
  zapisana w dziesiątych częściach (int). Mniej lepiej.
- Pusta lista = limit czasu = 5 × 100.
- Ekran: wzór i podgląd mają ten sam rozmiar (duże pole wydaje się jaśniejsze i bardziej nasycone), suwaki startują losowo,
  przycisk „Zatwierdź kolor” w kolorze gracza. Po zatwierdzeniu porównanie: wzór i odpowiedź obok siebie, zgodność w % (100 − ΔE)
  i podpowiedzi z `hints` („za ciemny”, „za mało nasycony”, „za bardzo w stronę żółci”; progi: jasność 8, nasycenie 10, barwa 10°).
  Po ostatnim kolorze nie ma porównania, od razu ekran wyników (pary wszystkich kolorów są tam).
- Tabela wyników pokazuje średnią zgodność w % (100 − suma ΔE / 5); kolejność ta sama co po sumie ΔE. Pod tabelą notka „więcej znaczy lepiej”,
  nad parami legenda „wzór | odpowiedź”; wszystkie procenty z jednym miejscem po przecinku.

### Policz kropki (`kropki`)
- 10 rund, w każdej 8-40 kropek (bez nakładania, odstęp środków ≥ 0,08) widocznych 1,5 s, potem gracz wpisuje liczbę.
- Jeden ruch z 10 odpowiedziami (int 0-99). Wynik liczy serwer: suma |odpowiedź − liczba kropek|, mniej lepiej.
- Pusta lista = limit czasu, liczona jak same zera (czyli błąd = suma kropek).
- Bez tolerancji: każda kropka różnicy to 1 punkt karny, w obie strony tak samo.
- Ruch `progress` (`done` = liczba odpowiedzianych rund, int 1-9) po każdej odpowiedzi poza ostatnią: tylko do podglądu u rywali
  (pasek „3/10” w pigułce gracza), nie odnawia limitu (`turn` ma stały klucz), może spaść po odświeżeniu strony.
- Ekran: kwadratowy kafel stoi w tym samym miejscu we wszystkich fazach (kropki, pole odpowiedzi, porównanie).
  Po każdej odpowiedzi kropki wracają na ekran razem z „Było 42, wpisałeś 38”, różnicą ze znakiem i sumą błędów;
  wynik idzie na serwer dopiero po „Wyniki” na ostatnim porównaniu.

### Który rok? (`rok`)
- 10 rund, w każdej jedno wydarzenie historyczne, wynalazek albo premiera; gracz ustawia rok suwakiem w zakresie 1900-2025.
- Pula `EVENTS` w `rok.ts`: ok. 160 wydarzeń z jednoznacznym rokiem w czterech działach (historia świata, historia Polski,
  wynalazki i technologia, popkultura); tekst nie zawiera czterocyfrowej liczby, premiera to rok pierwszej premiery.
  Serwer losuje z niej 10 różnych wydarzeń, te same dla wszystkich.
- Jeden ruch z 10 odpowiedziami (int 1900-2025). Wynik liczy serwer: suma |odpowiedź − rok|, mniej lepiej.
- Pusta lista = limit czasu partii = w każdej rundzie najgorszy możliwy błąd, czyli `max(rok − 1900, 2025 − rok)`.
- Limit rundy 20 s jest na kliencie: po czasie zatwierdza się rok ustawiony na suwaku. Suwak startuje na środku (1962).
  Limit partii 240 s = 10 × (20 s + 2,5 s odsłony) plus zapas.
- Ruch `progress` (`done` = liczba odpowiedzianych rund, int 1-9) po każdej odpowiedzi poza ostatnią: tylko do podglądu u rywali
  (pasek „3/10” w pigułce gracza), nie odnawia limitu (`turn` ma stały klucz), może spaść po odświeżeniu strony.
- Ekran: kafel z tekstem wydarzenia, dużym rokiem, suwakiem i przyciskami −1 / +1, nad nim pasek czasu rundy (ostatnie 5 s ostrzegawczy).
  Po zatwierdzeniu przez 2,5 s ten sam kafel pokazuje prawdziwy rok, na torze własny rok (kolor gracza) i prawdziwy (pierścień)
  oraz różnicę ze znakiem; potem sama wskakuje następna runda, po dziesiątej wynik idzie na serwer.
- Ekran końcowy: jedna lista 10 wydarzeń z prawdziwym rokiem i odpowiedziami graczy (w trakcie tylko własne, po końcu wszystkich).

### Środek (`srodek`)
- 10 rund, w każdej odcinek pod losowym kątem na kwadratowym polu; gracz dotyka jego środka.
- Odcinki losowane: kąt dowolny, długość 0,5-0,9 boku pola, oba końce co najmniej 0,05 od krawędzi, środek w losowym miejscu,
  na ile pozwala długość. Długie, bo niedokładność palca jest stała (kilka px), a pomyłka oka rośnie z długością:
  na krótkim odcinku gra mierzyłaby palec, nie oko.
- Jeden ruch z 10 punktami dotknięcia (`x`, `y` w ułamkach pola). Wynik liczy serwer, więc nie zależy od rozmiaru telefonu.
- Dotknięcie jest rzutowane prostopadle na prostą odcinka i błąd rundy to odległość rzutu od środka, mierzona wzdłuż odcinka,
  w procentach jego długości (koniec odcinka = 50%). Każda runda waży więc tyle samo, niezależnie od długości.
  Odchylenie w bok nic nie kosztuje: liczy się tylko to, czy gracz dobrze ocenił połowę.
- Strefa akceptacji: dotknięcie dalej niż 30 umownych px od odcinka (pole ma bok 300 px; strefa jest w px, bo dotyczy palca) (od najbliższego punktu, także za końcami) nie jest odpowiedzią.
  Ekran je ignoruje bez kary, serwer odrzuca cały ruch z takim punktem. Dzięki temu przypadkowe stuknięcie w puste pole nie psuje rundy,
  a rzutowania nie da się nadużyć, stukając daleko obok.
- Wynik = suma błędów z 10 rund, zapisana w dziesiątych częściach procenta (int), mniej lepiej. Największy możliwy błąd rundy
  to koniec odcinka plus strefa (50% + 20% na najkrótszym), więc jedna wpadka nie kosztuje więcej.
- Pusta lista = limit czasu = 10 × 100% (więcej niż najgorsza uczciwa partia).
- Ekran: kwadratowy kafel z odcinkiem (poprzeczne kreski na końcach). Liczy się miejsce podniesienia palca: punkt można przytrzymać
  i przesunąć, a przy dotyku nad kaflem jest lupa ok. 1,7× (mysz jej nie ma). W trakcie celowania pierścień pokazuje rzut na odcinek
  (tylko w strefie akceptacji). Puszczenie poza strefą: potrząśnięcie odcinka, wibracja 60 i „Dotknij na odcinku”, runda trwa dalej.
  Po puszczeniu przez 1 s widać własny punkt na odcinku (kolor gracza), prawdziwy środek (pierścień), odcinek błędu między nimi
  i błąd w %; kolor według celności: do 2% zielony z „Idealnie!”, do 8% zwykły, dalej ostrzegawczy.
  Potem sama wskakuje następna runda; po dziesiątej wynik idzie na serwer.
- Ekran końcowy: jedna tabela, rundy 1-10 w kolumnach, gracze w wierszach (kolejność rankingu). Liczby w kolorach celności,
  najlepszy w rundzie (bez remisu) ma tło w kolorze gracza.

### Stój! (`stoj`)
- 30 s. Jedno duże pole zapala się na zielono (dotknij) albo czerwono (nie wolno), potem na chwilę gaśnie i przychodzi następny bodziec.
- Tempo rośnie: odstęp między bodźcami maleje liniowo z czasem partii od 1000 ms do 500 ms. Bodziec widać przez 0,6 odstępu,
  ale dotknięcie liczy się aż do pojawienia się następnego. Harmonogram (`SCHEDULE`) wynika ze stałych, jest ten sam w każdej partii.
- Losowe jest tylko to, które bodźce są czerwone: dokładnie co trzeci (`round(N / 3)`), w kolejności potasowanej na serwerze.
- Jedno dotknięcie na bodziec. Zielony = trafienie, czerwony = błąd. Dotknięcie szybciej niż 100 ms od pojawienia się to zgadywanie:
  ekran je ignoruje. Przepuszczony zielony nic nie kosztuje (brak punktu).
- Jeden ruch z `taps`: czas reakcji na każdy bodziec w ms (int) albo `null`, gdy nie było dotknięcia. Wynik liczy serwer:
  `times` (reakcje na zielone) i `errors` (dotknięte czerwone).
- Wynik = trafienia − 2 × błędy, nie mniej niż 0, więcej lepiej. Przy remisie niższa średnia reakcji; dwa wyniki bez trafień to remis,
  a zero punktów z trafieniami jest wyżej niż zero bez trafień.
- Kara jest punktowa, nie blokadą 1 s jak w innych grach na czas: blokada zjadałaby kolejne bodźce, a −2 przy 1/3 czerwonych
  i tak zeruje klepanie na oślep (N − 3 × czerwone ≈ 0).
- Walidacja: najwyżej tyle czasów, ile bodźców, każdy od 100 ms do odstępu swojego bodźca. Pusta lista = limit czasu = 0 pkt.
- Ekran: zielony z napisem „Dotknij”, czerwony z dłonią i „Stój!” (kolor nie jest jedynym sygnałem), bez przejścia. Trafienie gasi pole,
  błąd to czerwony błysk z potrząśnięciem i wibracja 60. Ekran końcowy: tabela z punktami, średnim czasem i błędami (wspólna z `Quiz.tsx`).

### Śledzenie (`sledzenie`)
- Do 20 rund. W każdej 8 identycznych kulek na kwadratowym polu, 3 z nich (cele) są podświetlone przez 1,5 s, potem wszystkie
  ruszają się przez 5 s i stają; gracz wskazuje 3 kulki.
- Pierwsza pomyłka kończy partię (jak w Sekwencji): runda jest zaliczona tylko z kompletem 3 celów.
- Tempo rośnie: prędkość kulek to 0,3 boku pola na sekundę w pierwszej rundzie i o 0,06 więcej w każdej następnej (w dwudziestej ok. 1,45).
  Wszystkie kulki w rundzie mają tę samą prędkość.
- Ruch: każda kulka leci po prostej i odbija się od krawędzi pola, kulki przenikają przez siebie (mijanie się jest tym trudnym momentem).
  Pozycja to wzór od czasu (`position(ball, round, t)`, fala trójkątna na każdej osi), bez symulacji krokowej: ta sama funkcja
  na serwerze i w ekranie, więc u wszystkich ruch jest identyczny.
- Serwer losuje dla każdej rundy 8 kulek: start (`x`, `y`) i kierunek (`angle`). Celami są kulki o indeksach 0-2 (pozycje są losowe,
  więc osobne losowanie indeksów nic by nie dało). Na starcie i po zatrzymaniu kulki się nie nakładają
  (promień 0,06 boku, odstęp środków co najmniej 0,14), w trakcie ruchu mogą.
- Jeden ruch z `picks`: wskazania z kolejnych rozegranych rund, w każdej dokładnie 3 różne indeksy kulek (int 0-7), kolejność bez znaczenia.
  Wynik liczy serwer: `rounds` = liczba rund od początku z kompletem celów, `hits` = trafione cele (0-2) w pierwszej rundzie z błędem.
  Wszystko po pierwszym błędzie jest ignorowane.
- Ranking: więcej rund wyżej, przy równych więcej `hits` („prawie się udało” wygrywa z pudłem); równe oba to remis.
- Walidacja: najwyżej 20 rund, każda to 3 różne liczby całkowite 0-7. Pusta lista = limit czasu = 0 rund i 0 trafionych.
- Bez ruchu `progress`: rywale nie widzą numeru rundy (jak w Sekwencji).
- Ekran: kwadratowy kafel z kulkami; cele podświetlone kolorem gracza, w ruchu wszystkie jednakowe. Po zatrzymaniu dotknięcie zaznacza kulkę
  (ponowne odznacza), trzecie zatwierdza. Potem przez 1 s widać prawdziwe cele; pomyłka to wibracja 60.
  Ruch kulek jest treścią gry, więc działa także przy `prefers-reduced-motion`.

### Wieża (`wieza`)
- Do 30 pięter. Pole ma szerokość 1. Na dole leży podstawa o szerokości 0,4 na środku pola; każdy następny klocek ma szerokość
  poprzedniego i jeździ w poziomie od krawędzi do krawędzi pola, a gracz zatrzymuje go dotknięciem.
- Odchyłka od poprzedniego klocka najwyżej 0,02 (`SNAP`) to trafienie idealne: klocek wyrównuje się i zachowuje szerokość.
  Większa odchyłka: zostaje tylko część wspólna z poprzednim klockiem, reszta jest ucinana.
- Część wspólna węższa niż 0,02 (`MIN_WIDTH`) to pudło i koniec partii. Pierwszy klocek zawsze trafia (przy podstawie 0,4 nie da się
  odjechać dalej niż o 0,3), pudło jest możliwe dopiero na zwężonej wieży.
- Tempo rośnie: prędkość klocka to 0,5 pola na sekundę na pierwszym piętrze i o 0,03 więcej na każdym następnym.
- Serwer losuje dla każdego piętra stronę, z której startuje klocek (`sides`, true = z lewej). Pozycja to wzór od czasu
  (`left(fromLeft, level, width, t)`, fala trójkątna lewej krawędzi w `[0, 1 − width]`), bez symulacji krokowej: ta sama funkcja
  na serwerze i w ekranie.
- Niedotknięty klocek spada sam po 5 s (`MAX_STOP_MS`) tam, gdzie akurat jest.
- Jeden ruch ze `stops`: czasy zatrzymania kolejnych klocków w ms od ich startu (int 0-5000). Wynik liczy serwer (`build`):
  `height` = liczba położonych klocków, `width` = szerokość ostatniego położonego (przy 0 klocków szerokość podstawy).
  Czasy po pudle są ignorowane.
- Ranking: wyższa wieża wyżej, przy równych szerszy ostatni klocek; równe oba to remis.
- Walidacja: najwyżej 30 czasów, każdy całkowity 0-5000. Pusta lista = limit czasu = 0 pięter.
- Ruch `progress` (`height` = wysokość wieży, int 1-29) po każdym położonym klocku poza trzydziestym: tylko do podglądu u rywali
  (pasek i `10/30` w pigułkach graczy), nie wpływa na wynik. Po oddaniu wyniku pigułka pokazuje wysokość z wyniku.
  Limit przez `turn()` ze stałym kluczem: ruch `progress` nie odnawia 180 s, nawet gdy gra już tylko jedna osoba.
- Ekran: kwadratowy kafel, widać 8 górnych pięter, klocki w kolorze gracza. Dotknięcie kafla zatrzymuje klocek. Trafienie idealne
  błyska na zielono, ucięty kawałek robi się czerwony i spada. Nad wieżą na chwilę pojawia się ocena: „Idealnie!”, procent klocka,
  który został, albo „Pudło”. Statystyki: wysokość, szerokość i seria (trafienia idealne z rzędu). Pod kaflem jedno zdanie podpowiedzi.
  Pudło to wibracja 60 i po 1 s wynik.
  Ruch klocka jest treścią gry, więc działa także przy `prefers-reduced-motion`.

### Rytm (`rytm`)
- Po „Start” 1 s ciszy, potem metronom gra 8 uderzeń (`BEATS`, 2 takty po 4) i cichnie, a gracz stuka dalej w tym samym tempie
  przez 10 s (`TAP_MS`), licząc od ostatniego uderzenia metronomu.
- Tempo losuje serwer: 70-130 BPM co 5 (13 wartości), to samo dla wszystkich. W stanie jest `interval = round(60000 / BPM)` ms (462-857)
  i `nonce` (rewanż może wylosować to samo tempo).
- Jeden ruch z `taps`: czasy stuknięć w ms (int) od ostatniego uderzenia metronomu. Stuknięcia przed nim i po 10 s ekran ignoruje.
- Wynik liczy serwer (`deviation`): odstępy to różnice kolejnych czasów, pierwszy liczy się od ostatniego uderzenia metronomu.
  Błąd odstępu = różnica względem `interval`, ucięta do `interval`. Oczekiwana liczba odstępów to `floor(10 000 / interval) − 1`
  (`expected`; jedno uderzenie zapasu, żeby grający odrobinę za wolno nie tracił ostatniego stuknięcia o włos); każdy brakujący
  liczy się jak najgorszy, czyli `interval`. Wynik = suma błędów podzielona przez większą z liczb: oczekiwaną i faktyczną liczbę odstępów,
  zaokrąglona do ms.
- Odchyłka liczy się z odstępów, nie od idealnej siatki metronomu: przy siatce mały błąd tempa kumuluje się i po rozjechaniu
  o pół uderzenia wynik jest przypadkowy.
- Skutki: pominięte uderzenie to jeden odstęp z pełnym błędem, klepanie na oślep daje wynik bliski `interval`,
  a dwa idealne stuknięcia i koniec nie wygrywają.
- Wynik = średnia odchyłka w ms (int, od 0 do `interval`), mniej lepiej; równe to remis.
- Walidacja: najwyżej 60 czasów (`MAX_TAPS`), każdy całkowity 1-10 000, ściśle rosnące. Pusta lista = limit czasu = wynik równy `interval`.
- Grający nie widzi limitu tury po starcie (jak w Stoperze: pasek tykający co sekundę podawałby tempo 60 BPM); ekran stukania
  nie ma licznika sekund, tylko płynny pasek.
- Jedyna gra z dźwiękiem: metronom klika (WebAudio), błyska polem (pierwsze uderzenie taktu mocniej) i wibruje 30. Bez gestu
  (start sam po 15 s instrukcji) albo przy wyciszonym telefonie zostaje błysk i wibracja, więc gra jest grywalna z samym błyskiem.
- Ekran: całe pole reaguje na dotyk i błyska kolorem gracza. Ekran końcowy: kafel z własnym tempem w BPM obok celu i tabela z odchyłkami.

### Inny element (`inny`)
Wynik, walidacja, ranking i ekran końcowy jak w Kolorze liter (`quiz.ts`, `Quiz.tsx`); inne jest tylko to, co widać na planszy.
- 30 s. Siatka identycznych symboli, jeden się różni; dotykasz tego jednego.
- Serwer losuje 200 plansz, te same dla wszystkich. Plansza `{ cols, rows, odd, base, other }`: wszystkie pola mają symbol `base`,
  pole `odd` ma `other`. Symbol to `{ sides, angle, hue, light, size }` (wielokąt foremny, obrót w stopniach, barwa i jasność HSL, rozmiar w % pola symbolu).
- Siatka rośnie z każdym trafieniem na przemian o kolumnę i wiersz: 2×2, 3×2, 3×3, 4×3 … 6×6 na planszy 8 i dalej bez zmian
  (`MAX_SIDE = 6`: przy 360 px kafel ma wtedy 48 px).
- `other` różni się od `base` dokładnie jednym polem, rodzaj różnicy losowany po równo co planszę. Różnica maleje liniowo
  od planszy 0 do planszy 16 (`HARD`), dalej jest stała:
  - **obrót**: trójkąt, `angle` ± od 40° do 8°,
  - **odcień**: `light` ± od 20 do 5 punktów (jasność, nie barwa, więc działa też dla daltonistów),
  - **rozmiar**: `size` ± od 20 do 10 punktów przy bazowym 80,
  - **kształt**: `sides` n kontra n ± 1, n = `3 + floor(i / 3)`; nigdy mniej niż 3 boki. Tylko na planszach 0-7 (`SHAPE_BOARDS = 8`,
    dopóki siatka rośnie): inna liczba boków rzuca się w oczy nawet na 6×6, więc dalej zostają same subtelne różnice.
  Barwa bazowa, kąt bazowy, znak różnicy i pole `odd` są losowe.
- Pomyłka blokuje na 1 s i plansza zostaje (numer planszy = liczba trafień). Czas trafienia liczy się od pierwszego pokazania planszy;
  szukanie dłuższe niż 5 s liczy się jak 5 s.
- Limit czasu: zero trafień.

## 2. Gomoku (`piec-w-rzedzie`)

- Plansza 15×15, dwóch graczy stawia na zmianę; zaczyna `players[0]`.
- Wygrywa 5 lub więcej w linii (poziomo, pionowo, po skosie); dłuższa linia też wygrywa.
- Pełna plansza bez linii = remis (`isOver` zwraca `{}` bez zwycięzcy).
- Limit czasu: losowe wolne pole.

## 3. Statki (`statki`)

- Tryb wybiera gospodarz w lobby (`modes` w definicji gry, `MODES` w `statki.ts`); nieznany albo brak = `klasyczny` (domyślny).
  Lista jest ułożona od najkrótszej partii do najdłuższej.
  Rewanż gra w tym samym trybie, ranking liczy wszystkie tryby razem.

  | Tryb | Plansza | Flota | Stykanie |
  |---|---|---|---|
  | `szybki` | 8×8 | 4, 3, 2, 2 | nie |
  | `hasbro` | 10×10 | 5, 4, 3, 3, 2 | tak |
  | `klasyczny` | 10×10 | 4, 3, 3, 2, 2, 2, 1, 1, 1, 1 | nie |
  | `flota` (Flota wojenna) | 12×12 | 6, 5, 4, 4, 3, 3, 2, 2 | nie |

- Statki proste. Bez stykania: nie mogą się dotykać, także rogami. Ze stykaniem: nie mogą się tylko nakładać.
- **Faza `placing`** (obaj naraz): serwer losuje każdemu poprawną flotę. `place` podmienia całą flotę (walidacja `isValidFleet`),
  `ready` zamyka ustawianie, `unready` je otwiera z powrotem (dopóki drugi gracz nie jest gotowy). Gdy obaj gotowi, zaczyna się bitwa.
  Limit czasu: `ready` z aktualnym ustawieniem.
- **Faza `battle`**: zaczyna `players[0]`. Pudło oddaje turę, trafienie daje kolejny strzał.
- Zatopienie: pola statku dostają wynik `sunk`, a wszystkie pola dookoła (także po skosie) są oznaczane `around`
  i nie da się już w nie strzelić. W trybie ze stykaniem pól dookoła się nie oznacza (może tam stać inny statek).
- Wygrywa ten, kto zatopi całą flotę przeciwnika. Limit czasu: strzał w losowe nieostrzelane pole.
- Limit przez `turn(state)`: całe rozstawianie ma jeden licznik 90 s (`PLACING_SECONDS`), którego nie odnawia ani `place`,
  ani `ready`, ani `unready` (inaczej dałoby się przeciągać rozstawianie bez końca). W bitwie 60 s od nowa po każdym strzale.
- **Ukrywanie stanu**: `playerView` pokazuje właścicielowi wszystkie jego statki, pozostałym (przeciwnik, obserwator) tylko zatopione.

## 4. Chińczyk (`chinczyk`)

- 2-4 graczy, każdy ma 4 pionki. Tor ma 40 pól, potem 4 pola domku końcowego.
- Pozycje liczone od własnego startu: −1 domek startowy, 0-39 tor, 40-43 domek końcowy. Starty co 10 pól; przy dwóch graczach
  naprzeciw siebie (0 i 20).
- Jedna kostka. Wyjście z domku startowego tylko na 6 (na pozycję 0).
- Ruch musi zmieścić się w torze: nie wolno przeskoczyć pozycji 43. Nie wolno stanąć na własnym pionku (także w domku końcowym).
- W domku końcowym nie wolno przeskakiwać własnych pionków, także wchodząc z toru: żaden własny pionek nie może stać
  na polach 40-43 między pozycją startową a docelową.
- Zbicie: pionki przeciwników stojące na tym samym polu toru wracają do domku startowego.
- Pole startowe jest bezpieczne, gdy stoi na nim pionek właściciela (jego pozycja 0): rywal nie może na nim stanąć
  (ruch niedozwolony, przeskoczyć wolno). Obcy pionek na cudzym polu startowym nie jest chroniony, więc wychodzący go zbija.
- Szóstka daje kolejny rzut, także wtedy, gdy nie było możliwego ruchu. Trzecia szóstka z rzędu kończy turę bez ruchu.
- Gdy gracz nie ma żadnego pionka na torze i nie może się ruszyć, ma do 3 rzutów w turze.
- Jedyny możliwy ruch wykonuje się sam; faza `move` (wybór pionka) jest tylko przy 2+ możliwościach.
  Pionki w domku startowym są nierozróżnialne: ruszyć można tylko pierwszym.
- Gracz kończy, gdy wszystkie 4 pionki są w domku końcowym; trafia do `ranking` i wypada z kolejki (bez dodatkowego rzutu,
  nawet po szóstce). Gra toczy się do pełnego rankingu: gdy zostaje jeden gracz, dopisywany jest na końcu.
- Limit czasu: rzut albo losowy z możliwych pionków. Limit przez `turn(state)`: klucz zmienia się po każdym rzucie i ruchu.

**Tryby** (`MODES`): powyżej opisany jest **Klasyczny** (`klasyczny`, domyślny, 60 s). **Szybki** (`szybki`, 20 s, partia na około 10 minut) zmienia:
- Start: jeden pionek stoi już na pozycji 0, trzy w domku startowym.
- Wyjście z domku startowego na 1 albo 6 (kolejny rzut dalej tylko po szóstce).
- Bez dokładnego rzutu: gdy pozycja + oczka przekracza 43, pionek wchodzi na najdalsze wolne pole domku końcowego
  dalsze niż jego pozycja (gdy takiego nie ma, ruchu nie ma). Własne pionki w domku wolno przeskakiwać.
- Zbicie daje dodatkowy rzut. Wejście pionka z toru do domku końcowego też (zawsze jeden dodatkowy rzut, także po szóstce).
- Koniec: pierwszy gracz z 3 pionkami w domku końcowym wygrywa i partia kończy się od razu. Reszta rankingu:
  więcej pionków w domku końcowym, potem większa suma pozycji.

## 5. Państwa-miasta (`panstwa-miasta`)

- 2-6 graczy, 5 rund. Każda runda na inną literę z `ABCDEFGHIJKLŁMNOPRSTUWZ` (bez powtórek w partii).
  `playerView` wysyła litery przyszłych rund jako puste; `nonce` w stanie służy tylko do montowania komponentu od nowa przy rewanżu.
- Kategorie: Państwo, Miasto, Zwierzę, Roślina, Rzecz, Imię. Odpowiedź do 30 znaków.
- **Pisanie (`write`, 90 s)**: wszyscy naraz. Ruch `write` z `done: false` to szkic zapisywany w tle; `done: true` oddaje kartkę.
  Pierwsze oddanie kartki (z kompletem albo bez) to STOP: licznik reszty startuje od nowa na 7 s.
  Po czasie serwer oddaje za gracza jego ostatni szkic.
- **Głosowanie (`vote`, 45 s)**: każdy raz wysyła listę odrzucanych odpowiedzi (nie swoich). Odpowiedź odpada, gdy odrzuci ją
  ponad połowa pozostałych graczy. Odpowiedź pusta albo na złą literę odpada sama (Ł to inna litera niż L). Limit czasu: nic nie odrzucam.
- **Punkty za kategorię**: 15 jedyna ważna odpowiedź w kategorii, 10 ważna i unikalna, 5 powtórzona, 0 brak lub odrzucona.
  Powtórki porównuje `normalize`: bez wielkości liter, polskich znaków i nadmiarowych spacji.
- **Podsumowanie (`summary`, 20 s)**: następna runda, gdy wszyscy klikną „Dalej” (`next`) albo minie czas. Po 5. rundzie od razu koniec.
- Wygrywa suma punktów; przy remisie na górze nie ma zwycięzcy.
- **Ukrywanie stanu**: w pisaniu każdy widzi tylko swój szkic, w głosowaniu tylko swój głos; potem wszystko jest jawne.
- Limit przez `turn(state)`: klucz `faza:runda:stop`, więc licznik startuje od nowa przy zmianie fazy, rundy i przy STOP.

## 6. Kampus Tour (`kampus-tour`)

2-4 graczy (limit 4 to decyzja, nie przeoczenie), 6 postaci do wyboru. Balans ekonomii i jego historia: `KONCEPT.md`, sekcja 9.

### Plansza (32 pola, indeksy zgodnie z ruchem wskazówek zegara)

| Pola | Co |
|---|---|
| 0 | Początek |
| 1, 2 | grupa 0, cena 10: Automat z kawą, Automat z przekąskami |
| 3, 4, 6 | grupa 1, cena 15: Biblioteka PRz, Hala sportowa PRz, Rektorat |
| 5, 13, 21 | Karty Dziekanatu |
| 7, 29 | Ksero, Stołówka (cena 30, czynsz z rzutu) |
| 8, 9, 10 | grupa 2, cena 20: Wydziały Mechaniczny, Elektryczny, Chemiczny |
| 11 | Kolokwium |
| 12, 14, 15 | grupa 3, cena 25: Hala Podpromie, Stadion Stali, Zalew Rzeszowski |
| 16 | Juwenalia |
| 17, 18, 19 | grupa 4, cena 30: Ulica 3 Maja, Galeria Rzeszów, Millenium Hall |
| 20, 22, 23 | grupa 5, cena 35: Kino, Kręgielnia, Klub studencki |
| 24, 25, 26 | grupa 6, cena 40: Bulwary nad Wisłokiem, Okrągła kładka, Pomnik Czynu Rewolucyjnego |
| 27 | Bilet MPK |
| 28 | Opłata za akademik (15 zł do banku) |
| 30, 31 | grupa 7, cena 50: Zamek Lubomirskich, Rynek |

### Start i tura
- Gotówka: 200 zł + 20 zł za każde dalsze miejsce w kolejce (wyrównuje przewagę pierwszego ruchu).
- Faza `pick`: wszyscy naraz wybierają postać, każda tylko raz. Potem tury po kolei od `players[0]`.
- Rzut dwiema kośćmi, ruch o sumę. Przejście przez Początek (albo stanięcie na nim) daje 40 zł kieszonkowego.
- Dublet daje kolejny rzut po rozliczeniu pola. Trzeci dublet z rzędu: od razu na Kolokwium, bez ruchu.
- Fazy po rzucie: `card`, `buy`, `buyout`, `build`, `sell`, `juwenalia`; po rozliczeniu `finish` (kolejny rzut po dublecie albo następny gracz).

### Pola do kupienia
- Wolne pole: faza `buy`, jeśli gracza stać (`buy` albo `skip`). Nie stać: nic się nie dzieje.
- Własne pole (także zaraz po kupnie lub wykupieniu): faza `build`, jeśli jest co budować i stać na kolejny poziom.
- Cudze pole: czynsz dla właściciela, potem ewentualnie wykupienie.

### Czynsz (P = cena pola)
- Bez budynków: P/10 (zaokrąglone); komplet grupy podwaja.
- Z budynkami, poziomy 1-4: 0,4P / P / 2P / 4P (zaokrąglone). Mnożnik za komplet już się nie dolicza.
- Ksero i Stołówka: suma oczek × 2 przy jednym polu, × 5 przy obu. Nie da się na nich budować.
- Juwenalia na polu mnożą czynsz (patrz niżej); karta „Nocny autobus MPK” dodatkowo × 2.

### Budowa
- Tylko na polu, na którym gracz właśnie stoi. Jednym ruchem `build` można wskoczyć o kilka poziomów.
- Poziomy 1-3 kosztują po P/2 (zaokrąglone), poziom 4 (landmark) kosztuje P.
- Bez kompletu grupy najwyżej poziom 2; poziom 3 i landmark tylko z kompletem.

### Wykupienie (`buyout`)
- Po zapłaceniu czynszu można wykupić cudze pole za 2 × wartość (cena + koszt postawionych budynków); pieniądze dostaje właściciel,
  budynki zostają.
- Nie dotyczy landmarków. Oferta jest tylko, gdy gracza stać, i nie ma jej, gdy na czynsz trzeba było sprzedawać pola.

### Dług, sprzedaż, bankructwo
- Gdy gotówki brakuje na czynsz, opłatę lub kartę, a gotówka + sprzedaż pól wystarczy: faza `sell`. Gracz sprzedaje pola bankowi
  za połowę wartości (zaokrąglone w dół, razem z budynkami), aż starczy; dług spłaca się sam.
- Gdy nawet sprzedaż wszystkiego nie wystarczy: bankructwo. Gotówka idzie do wierzycieli (po równo, reszta przepada),
  pola wracają do banku bez budynków.
- Pole, które wraca do banku, traci Juwenalia.

### Pola specjalne
- **Kolokwium** (pole 11): samo stanięcie na nim nic nie robi. Trafia się tam przez trzeci dublet albo kartę „Spóźnienie na zajęcia”:
  pionek idzie na pole 11 bez kieszonkowego i tura się kończy. W następnej turze gracz rzuca:
  - ma kartę „Zaliczenie w pierwszym terminie”: zużywa ją (wraca na spód talii) i rusza się normalnie, dublet daje kolejny rzut,
  - dublet: zdaje, rusza się o oczka, ale bez dodatkowego rzutu,
  - inaczej: traci tę turę; w kolejnej jest już wolny.
- **Juwenalia** (pole 16): gracz, który ma choć jedno pole, wybiera własne pole z mnożnikiem czynszu. Pierwsze Juwenalia w partii × 2,
  kolejne × 3, × 4 itd. (licznik wspólny dla wszystkich). Naraz tylko jedno pole: nowe Juwenalia zastępują stare.
- **Bilet MPK** (pole 27): tura kończy się od razu (także po dublecie). W następnej turze zamiast rzutu można `travel` na dowolne
  inne pole: bez kieszonkowego za Początek, bez dodatkowego rzutu; kości są rzucane tylko po to, żeby policzyć czynsz
  za Ksero i Stołówkę. Zwykły rzut zużywa niewykorzystany bilet.
- **Opłata za akademik** (pole 28): 15 zł do banku.

### Karty Dziekanatu (18 kart, `CARDS`)
- Talia tasowana w `setup`. Karta jest dobierana z wierzchu (faza `card`), efekt działa po ruchu `card` (odkrycie), karta wraca na spód.
  „Zaliczenie” zostaje u gracza do użycia.
- Gotówka z banku: +30, +20, +15, +25. Do banku: −30, −10, −20.
- Korepetycje: każdy płaci graczowi 5 zł, ale najwyżej tyle, ile ma (nie wpędza w dług).
- Składka na imprezę: gracz płaci każdemu po 5 zł.
- Remont w akademiku: 5 zł za każdy poziom budynków, 20 zł za każdy landmark.
- Spóźnienie na zajęcia: na Kolokwium. Zaliczenie w pierwszym terminie: karta do zachowania.
- Zgubiona legitymacja: 3 pola wstecz (bez kieszonkowego), pole jest rozliczane.
- Idź na: Początek (0), Rynek (31), Juwenalia (16), Automat z kawą (1). Ruch do przodu, mijając Początek dostaje się kieszonkowe,
  pole docelowe jest rozliczane.
- Nocny autobus MPK: na najbliższe Ksero albo Stołówkę do przodu, właścicielowi podwójny czynsz.

### Koniec gry
- **Bankructwo**: zostaje jeden gracz.
- **Monopol**: 3 pełne grupy kolorów (Ksero i Stołówka się nie liczą) kończą grę od razu; monopolista wygrywa niezależnie od majątku.
- **Limit**: po 20 rundach wygrywa największy majątek (gotówka + wartość pól z budynkami); przy równym majątku na górze remis bez zwycięzcy.
- Ranking: żyjący według majątku (monopolista pierwszy), potem bankruci od ostatniego do pierwszego.

### Limit tury i widok
- `timeoutMove`: `pick` losowa wolna postać; `buy`, `build`, `buyout` pominięcie; `juwenalia` najdroższe własne pole;
  `card` odkrycie; `sell` najtańsze pole; w pozostałych rzut (czyli Bilet MPK przepada).
- `playerView` ukrywa kolejność talii (zostaje `deckSize`). `events` to 4 ostatnie zdarzenia, UI zamienia je na tekst.
- `stats` (majątek co rundę, zapłacony czynsz, dochód z pól, dublety) służy tylko ekranowi podsumowania.

## 7. Memory (`memory`)

- 2-6 graczy, wspólna plansza zakrytych kart, na każdej jeden z 18 symboli (`SYMBOLS`), każdy symbol dokładnie na dwóch kartach.
- Tryb wybiera gospodarz w lobby (`MODES` w `memory.ts`); nieznany albo brak = `srednia`. Ranking liczy wszystkie tryby razem.

  | Tryb | Plansza | Pary |
  |---|---|---|
  | `mala` (Mała) | 4×4 | 8 |
  | `srednia` (Średnia) | 4 kolumny × 6 rzędów | 12 |
  | `duza` (Duża) | 6×6 | 18 |

- `setup` losuje z 18 symboli tyle, ile par, i tasuje karty. Zaczyna `players[0]`.
- Jeden ruch `{ card }` (indeks karty): odkrycie zakrytej karty. Nie można odkryć karty zebranej ani drugi raz pierwszej karty tury.
- Pierwsza karta tury zostaje odkryta (`first`). Druga karta:
  - **para**: obie karty zostają odkryte u gracza (`owner`), ten sam gracz rusza dalej,
  - **pudło**: tura od razu przechodzi na następnego gracza, a `miss` trzyma indeksy obu kart do następnego odkrycia (ich symbole są wtedy w `faces`).
    Ekran pokazuje je przez 1,5 s (`MISS_MS` w `Memory.tsx`) albo krócej, jeśli następny gracz odkryje kartę wcześniej.
- Koniec, gdy wszystkie pary są zebrane. Wygrywa najwięcej par (`rankResults`); remis na pierwszym miejscu = bez zwycięzcy.
- Limit 60 s na każde odkrycie. Limit czasu: losowa zakryta karta.
- **Ukrywanie stanu**: `playerView` jest taki sam dla wszystkich (także obserwatora) i zawiera symbole tylko kart zebranych,
  `first` i `miss`. Symbol z `miss` zostaje w widoku także po zakryciu kart na ekranie (każdy go już widział).
