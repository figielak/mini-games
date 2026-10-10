# Nowa mini-gra: Wieża (`wieza`)

## Kontekst

Trzynasta mini-gra z grupy „Szybkie i refleksowe”: klocek jeździ w poziomie, gracz zatrzymuje go nad poprzednim,
wystająca część jest ucinana, więc wieża się zwęża. Wynik = wysokość wieży. Proces według `ZASADY.md`:
ustalenia → testy → zasady → ekran → opis, każdy krok osobnym commitem (commit dopiero na prośbę).

Ustalone z użytkownikiem: prawie idealne trafienie wyrównuje klocek bez ucinania, remis rozstrzyga szerokość
ostatniego klocka, bez ruchu `progress` (wysokości rywali nie widać w trakcie).

Uwaga: na gałęzi `stoj` leży niezacommitowane Śledzenie w tych samych plikach (`index.ts`, `Game.tsx`, `Lobby.tsx`,
`KONCEPT.md`, `ZASADY-GIER.md`). Wieżę dopisuję obok, niczego z niego nie ruszam; przy commitach trzeba je rozdzielić.

## Zasady (trafią do `ZASADY-GIER.md`)

- `id` `wieza`, nazwa „Wieża”, 1-6 graczy, mini-gra, `turnSeconds: 180` (30 pięter × 5 s = 150 s plus zapas).
- Stałe (pole ma szerokość 1): `LEVELS = 30` (sufit), `START_WIDTH = 0.4` (podstawa na środku), `SNAP = 0.02`,
  `MIN_WIDTH = 0.02`, `SPEED_START = 0.5` pola/s, `SPEED_STEP = 0.03` na piętro, `MAX_STOP_MS = 5000`.
  Prędkości do strojenia po partiach testowych.
- Serwer losuje w `setup` dla każdego piętra stronę startu klocka: `sides: boolean[]` (true = z lewej).
- Klocek ma szerokość poprzedniego i jedzie od krawędzi do krawędzi. Pozycja to wzór od czasu, bez symulacji:
  `left(fromLeft, level, width, t)` (fala trójkątna lewej krawędzi w `[0, 1 − width]`, wzór jak `reflectAxis` w `sledzenie.ts`).
  Ta sama funkcja na serwerze i w ekranie.
- Zatrzymanie: odchyłka od poprzedniego ≤ `SNAP` = idealne, klocek wyrównuje się i zachowuje szerokość.
  Inaczej zostaje część wspólna. Część wspólna < `MIN_WIDTH` = pudło, koniec partii.
- Niedotknięty klocek spada sam po `MAX_STOP_MS` tam, gdzie akurat jest.
- Jeden ruch `{ type: "result", stops: number[] }`: czasy zatrzymania kolejnych klocków w ms od ich startu.
  Wynik liczy serwer funkcją `build(sides, stops)` → `{ blocks: { left, width }[], height, width }`
  (`width` = szerokość ostatniego położonego klocka; przy 0 pięter `START_WIDTH`). Czasy po pudle są ignorowane.
- Ranking: wyższa wieża wyżej, przy równych szerszy ostatni klocek; równe oba = remis bez zwycięzcy (`rankResults`).
- Walidacja: gracz z gry, bez wyniku, najwyżej `LEVELS` czasów, każdy całkowity `0..MAX_STOP_MS`.
  Pusta lista = limit czasu = 0 pięter.

## Kroki (osobne commity)

1. **Ustalenia**: sekcja `### Wieża (`wieza`)` i wiersz tabeli w `ZASADY-GIER.md`; dopisek „Wieża” do listy gier, w których wynik liczy serwer (linia 36).
2. **Testy** `packages/games/src/wieza.test.ts` (wzór: `sledzenie.test.ts`, `stoj.test.ts`; `send`, gracze `A`/`B`/`C`, nagłówek z listą zasad):
   - definicja, setup (30 stron, różne seedy różne, ten sam seed to samo, rewanż inne wyzwanie),
   - `left`: zawsze w `[0, 1 − width]` (próbkowanie co 50 ms), start przy właściwej krawędzi, wyższe piętro jedzie szybciej,
   - `build`: idealne trafienie zachowuje szerokość, odchyłka `SNAP` jeszcze wyrównuje a tuż ponad ucina, ucięcie z lewej i z prawej,
     część wspólna poniżej `MIN_WIDTH` kończy partię, czasy po pudle ignorowane, 30/30, zepsute dane (pusta lista),
   - walidacja: obcy gracz, drugi wynik, czas −1 i `MAX_STOP_MS + 1` (0 i `MAX_STOP_MS` przechodzą), 31 czasów, po końcu gry,
   - schemat: zły typ, brak pola, liczba niecałkowita,
   - koniec: wygrana każdego gracza, remis rozstrzygnięty szerokością, pełny remis i solo bez zwycięzcy, `waitingFor` kurczy się i jest puste,
   - `timeoutMove` przechodzi `validateMove` i daje 0; `applyMove` nie mutuje, stan przeżywa JSON.
   Testy szukają czasu idealnego trafienia pomocnikiem (przeszukanie `left` co 1 ms), nie wpisanymi liczbami.
3. **Zasady** `packages/games/src/wieza.ts` (ok. 80 linii, szkielet ze `sledzenie.ts`), wpis w `GAMES` i eksporty w `index.ts`
   (`WiezaView`, stałe z prefiksem `WIEZA_` tam, gdzie nazwa koliduje, `left as wiezaLeft`, `build as wiezaBuild`);
   licznik gier w `index.test.ts`.
4. **Ekran** `apps/web/src/games/Wieza.tsx` + podpięcie (wzór `Sledzenie.tsx`):
   - fazy `intro → play → over → sent`; stan to tylko `stops: number[]`, wieża wyliczana z `wiezaBuild(view.sides, stops)`,
   - jadący klocek: pętla `requestAnimationFrame` ustawia `style.left` z `wiezaLeft(...)` (bez stanu Reacta na klatkę);
     po `MAX_STOP_MS` zatrzymuje się sam,
   - dotknięcie całego kafla (`onPointerDown`, `touch-none select-none`) dopisuje `Math.round(performance.now() − start)`;
     pudło albo 30. piętro: `over` przez 1 s (przy pudle `navigator.vibrate?.(60)`), potem `onMove`,
   - kwadratowy `.tile` jak w Śledzeniu, widać 8 górnych pięter, wieża zjeżdża w dół przez `transition-transform` 180 ms;
     klocki w kolorze gracza, ucięty kawałek zostaje przygaszony do następnego dotknięcia, idealne trafienie błyska `set-glow`,
   - `Stats`: „Wysokość n/30” i „Szerokość n%”; koniec: `Scores` z „12 pięter (34%)” i zdaniem o remisie,
   - `Intro` z `Preview` (trzy klocki, górny miga `preview-half`); bez nowych keyframes,
   - ruch klocka to treść gry, więc działa także przy `prefers-reduced-motion` (odnotować w `ZASADY-GIER.md`),
   - `screens/Game.tsx`: gałąź z `key={JSON.stringify(view.sides)}` i wpis w `MINI_GAMES`; `screens/Lobby.tsx`: ikona `Stack`, zdanie w `BLURBS`.
5. **Opis** w `KONCEPT.md`: punkt w 2.4, limit 180 s w regułach platformy, „13 sztuk” w tabeli etapów.

## Weryfikacja

- `pnpm --filter @mini-games/games exec vitest run src/wieza.test.ts` (po kroku 2 czerwone, po kroku 3 zielone), potem `pnpm typecheck && pnpm test`.
- `/dev?n=2` i solo w przeglądarce (Playwright, 360×640): pełna partia, pudło na 1. piętrze, klocek niedotknięty przez 5 s, remis, rewanż (inne strony),
  odświeżenie w trakcie, obserwator, limit czasu; wynik na ekranie zgadza się z wynikiem z serwera.
