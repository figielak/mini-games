# Nowa mini-gra: Mapa (`mapa`)

## Kontekst

Kolejna mini-gra z grupy „Szybkie i refleksowe”: pojawia się nazwa miasta, gracz wskazuje je na konturze Polski. 10 rund,
wynik = suma odległości w km (mniej lepiej), liczona na serwerze. Mechanicznie to bliźniak Środka (`srodek.ts`, `Srodek.tsx`):
10 rund, jeden ruch z 10 punktami `x`, `y` w ułamkach pola, serwer liczy błąd, na końcu tabela rund.
Proces według `ZASADY.md`: ustalenia → testy → zasady → ekran → opis, każdy krok osobnym commitem (commit dopiero na prośbę).

Ustalone z użytkownikiem:
- **tylko Polska** (Europa jako tryb `modes` później, gdy gra się sprawdzi),
- pula **ok. 60 największych miast** (wojewódzkie i duże, od ok. 70 tys. mieszkańców),
- wskazanie: **znacznik + „Zatwierdź”** (dotknięcie stawia znacznik, kolejne albo przeciągnięcie go przenosi),
- na mapie **sam kontur**, bez rzek i województw.

W drzewie roboczym na `master` leży niezacommitowany Obrót w tych samych plikach (`index.ts`, `Game.tsx`, `Lobby.tsx`, `KONCEPT.md`,
`ZASADY-GIER.md`); dopisuję obok, niczego z niego nie ruszam. Liczniki +1 względem stanu zastanego (liczba gier w `index.test.ts`,
„17 sztuk” w `KONCEPT.md`).

## Zasady (trafią do `ZASADY-GIER.md`)

- `id` `mapa` (na stałe), nazwa „Mapa”, 1-6 graczy, mini-gra, bez trybów, `turnSeconds: 180`
  (10 rund × ok. 10 s namysłu + 1,5 s odsłony, z zapasem; bez limitu na rundę).
- Serwer losuje w `setup` 10 różnych miast z puli (`shuffle` z `core.ts`, pierwsze `ROUNDS`), te same i w tej samej kolejności dla wszystkich.
  Miasto: `{ name, lat, lon }`.
- Pole gry to prostokąt geograficzny `BOUNDS` (ok. 14,0-24,3°E, 48,9-55,0°N, kontur z marginesem), odwzorowanie liniowe:
  `x` = długość, `y` = szerokość (północ u góry). `ASPECT` (szerokość/wysokość pola, ok. 1,04) wynika z `cos(52°)` i ekran rysuje kafel w tej proporcji.
  `// ponytail:` odwzorowanie walcowe równoodległościowe, zniekształcenie do ok. 6% na północy i południu; odległość i tak liczy się z lat/lon.
- Jeden ruch `{ type: "result", taps }`: 10 punktów `{ x, y }` w ułamkach pola (0-1) albo pusta lista (limit czasu).
- Błąd rundy = odległość po ortodromie (haversine, R = 6371 km) między wskazanym punktem a miastem, zaokrąglona do pełnych km.
  Wynik = suma z 10 rund (int, km), mniej lepiej; remis = bez zwycięzcy (`rankResults`).
- Punkt poza konturem Polski jest ważną odpowiedzią (liczy się sama odległość). Punkt poza polem (`x` lub `y` poza 0-1, `NaN`) odrzuca cały ruch.
- Limit czasu: `MAX_ERROR = 1000` km za każdą rundę (więcej niż przekątna pola, ok. 960 km), czyli 10 000.
- Miasta i ich współrzędne są w widoku od startu (ekran potrzebuje ich do odsłony), jak odcinki w Środku: `// ponytail:` da się podejrzeć, między znajomymi wystarczy.
- Obserwator i gracz po oddaniu wyniku widzą `Scores`; po końcu tabelę rund.

## Dane

- `packages/games/src/mapa-dane.ts`: `CITIES` (ok. 60 wpisów `[nazwa, lat, lon]`, współrzędne centrów do 0,01°) i `OUTLINE`
  (kontur Polski jako lista `[lon, lat]`, ok. 150-200 punktów).
- Kontur: Natural Earth 1:50m (domena publiczna), pobrany jednorazowo przy implementacji do scratchpada, uproszczony skryptem
  i wklejony jako stała. Bez nowej zależności i bez pliku w `public`. Gdyby sieć była niedostępna, zgłaszam to zamiast rysować kontur z pamięci.

## Kroki (osobne commity)

1. **Ustalenia**: `plany/mapa.md` (ten plan), sekcja `### Mapa (`mapa`)` i wiersz tabeli w `ZASADY-GIER.md`; „Mapa” dopisana do listy gier,
   w których wynik liczy serwer (sekcja 1).
2. **Testy** `packages/games/src/mapa.test.ts` (wzór: `srodek.test.ts`, nagłówek z listą zasad, gracze `A`/`B`/`C`, `send`):
   - definicja (1-6, 180 s, świeża gra nieskończona); setup: 10 miast bez powtórek, różne seedy różne, ten sam seed to samo,
   - dane: każde miasto z puli leży w `BOUNDS` i wewnątrz `OUTLINE` (ray casting w teście), nazwy bez powtórek, pula ma co najmniej 50 miast,
     kontur mieści się w `BOUNDS`,
   - `distance`: Warszawa-Kraków ok. 252 km, Gdańsk-Rzeszów ok. 530 km (tolerancja 5 km), ten sam punkt = 0, symetria,
   - `locate`/`place` są odwrotne; punkt wskazany dokładnie w mieście daje 0 km,
   - wynik = suma zaokrąglonych odległości z 10 rund; punkt poza konturem jest przyjmowany,
   - walidacja: gracz spoza gry, drugi wynik, 9 i 11 punktów, `x`/`y` = 0 i 1 przechodzą, −0,01 i 1,01 nie, `NaN` nie, ruch po końcu gry,
   - schemat odrzuca śmieci (zły typ, brak pola, tekst zamiast liczby),
   - limit czasu: `timeoutMove` przechodzi `validateMove` i daje 10 × `MAX_ERROR`; `MAX_ERROR` jest większy niż przekątna pola,
   - koniec gry: wygrana każdego z trzech, remis bez zwycięzcy, solo bez zwycięzcy, `waitingFor` puste, rewanż daje inne miasta,
   - `applyMove` nie mutuje, stan przeżywa JSON.
   - `index.test.ts`: liczba gier +1.
3. **Zasady**:
   - `packages/games/src/mapa.ts` (ok. 80 linii, szkielet ze `srodek.ts`): `ROUNDS`, `BOUNDS`, `ASPECT`, `MAX_ERROR`,
     `place({lat, lon}) → Point`, `locate(Point) → {lat, lon}`, `distance(a, b)` (haversine), definicja gry z `shuffle` i `rankResults` z `core.ts`.
   - `mapa-dane.ts` jak wyżej.
   - `index.ts`: wpis w `GAMES`, eksport `MapaView`, `MapaPoint`, `MAPA_ROUNDS`, `MAPA_ASPECT`, `MAPA_OUTLINE`, `mapaPlace`, `mapaLocate`, `mapaDistance`.
4. **Ekran** `apps/web/src/games/Mapa.tsx` (wzór `Srodek.tsx`, fazy `intro` / `play` / `reveal` / `sent`) + podpięcie:
   - `Intro` z `Preview`: mały kontur i migający znacznik (`preview-half`), punkty: „10 rund, w każdej jedno miasto”,
     „Dotknij mapy tam, gdzie leży miasto, popraw znacznik i zatwierdź”, „Liczy się suma odległości w km, mniej znaczy lepiej”.
   - Gra: `Stats` (Runda `n/10`, Suma `km`), nazwa miasta dużą czcionką nad mapą, kafel `.tile` w proporcji `ASPECT` z `touch-none select-none`,
     w nim `<svg>` z konturem (`<path>` zbudowany raz z `MAPA_OUTLINE` przez `mapaPlace`, obrys `stroke-line`, wypełnienie `surface`).
     `onPointerDown`/`onPointerMove` stawiają i przesuwają znacznik w kolorze gracza (pierścień `ring-pulse`), pod mapą `.btn-primary` „Zatwierdź”
     (nieaktywny bez znacznika).
   - Odsłona 1,5 s (`REVEAL_MS`): prawdziwe miejsce (pierścień `stone-pop`), linia do znacznika, pod mapą odległość mono `tabular-nums`
     („37 km”), progi koloru jak w Środku (do 20 km `success` i „Idealnie!”, ponad 150 km `warning`; stałe na górze pliku). Potem następna runda,
     po dziesiątej `onMove({ type: "result", taps })`.
   - Koniec: `Scores` (suma w km), notka „Suma odległości z 10 rund, mniej znaczy lepiej.” i tabela rund jak w Środku: nagłówek z numerami rund,
     pod spodem lista miast, wiersz na gracza z km w każdej rundzie, najlepszy w rundzie na tle w kolorze gracza. Układ komórek skopiowany ze Środka;
     wspólny komponent dopiero, gdy trzecia gra będzie go potrzebować.
   - `screens/Game.tsx`: gałąź jak dla `srodek` (`key` z nazw miast), wpis w `MINI_GAMES`; `screens/Lobby.tsx`: ikona `MapTrifold` w `ICONS`,
     zdanie w `BLURBS` („Nazwa miasta, wskazujesz je na konturze Polski. 10 rund, wygrywa najmniejsza suma kilometrów.”).
   - Bez nowych keyframes, klas i zależności.
5. **Opis** w `KONCEPT.md`: punkt w 2.4, limit 180 s w regułach platformy, liczba mini-gier +1; pamięć projektu bez zmian.

## Świadomie pominięte

- Europa (tryb `modes`), limit czasu na rundę, lupa, rzeki i województwa: dodać, gdy partie testowe pokażą potrzebę.

## Weryfikacja

- `pnpm --filter @mini-games/games exec vitest run src/mapa.test.ts` (po kroku 2 czerwone, po kroku 3 zielone), potem `pnpm typecheck && pnpm test`.
- `/dev?n=2` i solo (Playwright, 360×640): pełna partia; kontur wygląda jak Polska i mieści się bez przewijania razem z nazwą miasta i przyciskiem;
  znacznik postawiony na Rzeszowie przy mieście „Rzeszów” daje kilka km; przesuwanie znacznika przed zatwierdzeniem; odsłona pokazuje linię i km;
  suma z ekranu zgadza się z tabelą końcową; remis, rewanż (inne miasta, ekran od nowa), odświeżenie w trakcie, obserwator, autostart po 15 s, limit tury.
- Po partiach testowych: czy progi 20/150 km i pula miast są dobrze dobrane.
