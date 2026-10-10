# Nowa mini-gra: Inny element (`inny`)

## Kontekst

Kolejna mini-gra z grupy „Szybkie i refleksowe”: siatka identycznych symboli, jeden minimalnie się różni (obrót, odcień albo
kształt), dotykasz go. Siatka rośnie z każdym trafieniem, partia trwa 30 s, wynik = liczba trafień.
Proces według `ZASADY.md`: ustalenia → testy → zasady → ekran → opis, każdy krok osobnym commitem (commit dopiero na prośbę).

Ustalone z użytkownikiem:
- siatka rośnie **na przemian o kolumnę i wiersz**: 2×2, 3×2, 3×3, 4×3 … 6×6 po 8 trafieniach (6×6 to maksimum: kafel 48 px na 360 px),
- pomyłka = **blokada 1 s i ta sama plansza** (numer planszy = liczba trafień),
- rodzaj różnicy **losowany co planszę**, różnica maleje z każdym trafieniem.

Mechanika wyniku jest ta sama co w Kolorze liter i Liczeniu, więc gra dzieli z nimi `quiz.ts` i `Quiz.tsx` (ZASADY.md, sekcja 3),
zamiast dostawać własny zegar, walidację i tabelę wyników.

Uwaga: w drzewie roboczym leżą niezacommitowane Wieża, Rytm i Memory w tych samych plikach (`index.ts`, `index.test.ts`, `Game.tsx`,
`Lobby.tsx`, `ZASADY-GIER.md`, `KONCEPT.md`). Dopisuję obok, niczego z nich nie ruszam; liczniki podbijam o 1 względem stanu zastanego
(dziś: 21 gier w `index.test.ts`, „15 sztuk” w `KONCEPT.md`).

## Zasady (trafią do `ZASADY-GIER.md`)

- `id` `inny` (na stałe), nazwa „Inny element”, 1-6 graczy, mini-gra, `turnSeconds: 90` (jak Kolor liter).
- Serwer losuje w `setup` 200 plansz (`QUESTIONS` z `quiz.ts`), te same dla wszystkich. Plansza nr `i`:
  `{ cols, rows, odd, base, other }`, gdzie symbol to `{ sides, angle, hue, light }` (wielokąt foremny, obrót w stopniach, barwa i jasność HSL).
  Wszystkie pola mają `base`, pole `odd` ma `other`; ekran niczego nie liczy, tylko rysuje.
- Rozmiar: `cols = min(2 + ceil(i / 2), MAX_SIDE)`, `rows = min(2 + floor(i / 2), MAX_SIDE)`, `MAX_SIDE = 6`.
- `other` różni się od `base` **dokładnie jednym** polem, rodzaj losowany po równo z trzech; różnica maleje liniowo
  od planszy 0 do `HARD = 16`, dalej stała:
  - **obrót**: trójkąt (`sides: 3`), `angle` ± od `ANGLE_MAX = 40` do `ANGLE_MIN = 12` stopni,
  - **odcień**: `light` ± od `LIGHT_MAX = 20` do `LIGHT_MIN = 6` punktów (jasność, nie barwa: działa też dla daltonistów),
  - **kształt**: `sides` n kontra n + 1, n = `min(3 + floor(i / 3), 8)` (trójkąt/kwadrat na początku, ośmiokąt/dziewięciokąt na końcu).
  Barwa bazowa, kąt bazowy, znak różnicy i pole `odd` są losowe. Stałe do strojenia po partiach testowych.
- Jeden ruch `{ type: "result", times, errors }` (`QuizMove`): czasy trafień od pierwszego pokazania planszy i liczba pomyłek.
- Pomyłka: blokada 1 s, plansza zostaje. Trafienie: następna, większa plansza.
- Ranking jak w Kolorze liter: więcej trafień wyżej, przy remisie niższa średnia (`byHitsThenAverage`), równe = bez zwycięzcy.
- Walidacja wspólna (`validQuiz`): czasy 150-5000 ms (dłuższe szukanie liczone jako 5 s), suma ≤ 30 s, najwyżej 200. Limit czasu: zero trafień.
- `// ponytail:` wynik liczy klient jak w Kolorze liter; serwer odrzuca tylko nierealne wartości. Liczenie na serwerze (lista dotknięć z czasami),
  gdyby ktoś zaczął oszukiwać.

Zmiana po pierwszej partii (2026-10-10): doszedł czwarty rodzaj różnicy (rozmiar), kształt jest losowany tylko na planszach 0-7,
a dolne granice zmalały (obrót 8°, odcień 5). Aktualne liczby: `ZASADY-GIER.md`.

## Kroki (osobne commity)

1. **Ustalenia**: `plany/inny.md` (ten plan), sekcja `### Inny element (`inny`)` i wiersz tabeli w `ZASADY-GIER.md`;
   w sekcji Koloru liter dopisek, że `quiz.ts` i `Quiz.tsx` dzieli też Inny element.
2. **Testy** `packages/games/src/inny.test.ts` (wzór: `stroop.test.ts`, nagłówek z listą zasad, gracze `A`/`B`/`C`, `send`):
   - definicja (1-6, 90 s, świeża gra nieskończona); setup: 200 plansz, różne seedy różne, ten sam seed to samo, rewanż inne plansze,
   - siatka: 2×2, 3×2, 3×3 … 6×6 na planszy 8 i dalej bez zmian; `odd` zawsze w zakresie `cols × rows`,
   - różnica: `other` różni się od `base` dokładnie jednym polem; wszystkie trzy rodzaje występują; przy obrocie `sides` = 3;
     różnica na planszy 0 równa `*_MAX`, od planszy `HARD` równa `*_MIN`, nigdy mniejsza; kształt to zawsze ±1 bok,
   - walidacja, schemat, koniec gry, remis, solo, `timeoutMove`, niemutowanie i JSON: jak w `stroop.test.ts` + punkty obowiązkowe z `ZASADY.md`.
3. **Zasady** `packages/games/src/inny.ts` (ok. 60 linii, szkielet ze `stroop.ts`): `setup` z planszami, reszta to `quizMoveSchema`,
   `validQuiz`, `rankResults` + `byHitsThenAverage`. Wpis w `GAMES`, eksport `InnyView` w `index.ts`, licznik gier w `index.test.ts` +1.
4. **Ekran** + podpięcie:
   - `apps/web/src/games/Quiz.tsx`: dwa opcjonalne dodatki, bez zmiany zachowania Koloru liter i Liczenia:
     - `question()` może zwrócić `cols`: wtedy nie ma kafla z pytaniem, a odpowiedzi to kwadratowa siatka (`gridTemplateColumns` z `cols`,
       pola `aspect-square`, `rounded-inset`, wyśrodkowana `my-auto`) zamiast 2 kolumn po `min-h-24`,
     - prop `retry`: po blokadzie wraca ta sama plansza (`setPhase("play")` zamiast `next()`), czas liczy się od pierwszego pokazania.
     Zegar 30 s, `Stats`, błysk `tile-hit` / `tile-miss`, wibracja 60, `Results` i `Intro` zostają wspólne.
   - `apps/web/src/games/Inny.tsx` (wzór `Stroop.tsx`, ok. 50 linii): `Shape` = jeden `<svg>` z `<polygon>` (punkty z `sides`, `transform: rotate`,
     `fill: hsl(hue 70% light%)`), `question(i)` zwraca `cols` i `cols × rows` kształtów z `other` na `odd`, `retry`.
     `Preview`: siatka 3×2 trójkątów, jeden obrócony z obwódką `preview-half` (przez `QuizPreview` albo ten sam znacznik).
     Tekst zadania: „Jeden symbol różni się obrotem, odcieniem albo kształtem: dotknij go. Siatka rośnie po każdym trafieniu”.
   - `screens/Game.tsx`: gałąź jak dla `stroop` (`key` z `trials.map((t) => t.odd).join()`, `onRound={setInRound}`), wpis w `MINI_GAMES`;
     `screens/Lobby.tsx`: ikona `MagnifyingGlass` w `ICONS`, zdanie w `BLURBS`.
   - Bez nowych keyframes i klas w `index.css`.
5. **Opis** w `KONCEPT.md`: punkt w 2.4, dopisek przy „dzielą `quiz.ts` i `Quiz.tsx`”, limit 90 s w regułach platformy, liczba mini-gier +1.

## Weryfikacja

- `pnpm --filter @mini-games/games exec vitest run src/inny.test.ts` (po kroku 2 czerwone, po kroku 3 zielone), potem `pnpm typecheck && pnpm test`.
- `/dev?n=2` i solo (Playwright, 360×640): pełna partia do 6×6 (kafle ≥ 48 px, bez poziomego przewijania), pomyłka blokuje na 1 s i zostawia planszę,
  wynik z ekranu zgadza się z tabelą; remis, rewanż (inne plansze, ekran od nowa), odświeżenie w trakcie, obserwator, autostart po 15 s, limit tury.
- Regresja: jedna partia Koloru liter i Liczenia (układ i przejście po pomyłce bez zmian).
- Na telefonie: czy różnice `*_MIN` są jeszcze widoczne przy małej jasności ekranu (stałe do strojenia).
