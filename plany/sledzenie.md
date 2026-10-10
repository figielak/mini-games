# Nowa mini-gra: Śledzenie (`sledzenie`)

## Kontekst

Dwunasta mini-gra z grupy „Szybkie i refleksowe”: 8 identycznych kulek, 3 na chwilę podświetlone, potem wszystkie
się mieszają, a gracz wskazuje te 3. Tempo rośnie co rundę. Proces według `ZASADY.md`: ustalenia → testy → zasady → ekran → opis,
każdy krok osobnym commitem (commit dopiero na prośbę).

Ustalone z użytkownikiem: pierwsza pomyłka kończy partię, remis rozstrzygają trafione kulki w rundzie z błędem,
kulki lecą po prostych, odbijają się od ścian i przenikają przez siebie.

## Zasady (trafią do `ZASADY-GIER.md`)

- `id` `sledzenie`, nazwa „Śledzenie”, 1-6 graczy, mini-gra, `turnSeconds: 300` (20 rund × ok. 12 s plus zapas, jak Sekwencja).
- Stałe (nazwane, eksportowane te, których potrzebuje ekran): `BALLS = 8`, `TARGETS = 3`, `ROUNDS = 20` (sufit),
  `SHOW_MS = 1500` (podświetlenie), `MOVE_MS = 5000` (ruch), `RADIUS = 0.06` (pole ma bok 1),
  `SPEED_START = 0.3` boku/s, `SPEED_STEP = 0.06` na rundę (runda 20: ok. 1,45 boku/s). Prędkości do strojenia po partiach testowych.
- Serwer losuje w `setup` dla każdej rundy 8 kulek `{ x, y, angle }`. Celami są kulki o indeksach 0-2
  (pozycje są losowe, więc osobne losowanie indeksów nic nie daje).
- Pozycja kulki to wzór od czasu, bez symulacji krokowej: `position(ball, round, t)` w `sledzenie.ts`
  (ruch po prostej, odbicie od ścian = fala trójkątna na każdej osi w przedziale `[RADIUS, 1 − RADIUS]`). Ta sama funkcja na serwerze i w ekranie,
  więc u wszystkich ruch jest identyczny.
- Kulki nie nakładają się na starcie ani po zatrzymaniu (odstęp środków ≥ `2 × RADIUS + 0.02`): losowanie z odrzucaniem jak `scatter` w `kropki.ts`,
  sprawdzane przez `position(..., 0)` i `position(..., MOVE_MS)`. W trakcie ruchu przenikają.
- Jeden ruch `{ type: "result", picks: number[][] }`: wskazania z kolejnych rozegranych rund, w każdej dokładnie 3 różne indeksy 0-7.
  Wynik liczy serwer: `rounds` = liczba rund od początku z kompletem celów, `hits` = trafione cele (0-2) w pierwszej rundzie z błędem.
  Wszystko po pierwszym błędzie jest ignorowane.
- Ranking: więcej rund wyżej, przy równych więcej `hits`; równe oba = remis bez zwycięzcy (`rankResults` z `core.ts`).
- Walidacja: gracz z gry, bez wyniku, najwyżej `ROUNDS` rund, każda to 3 różne liczby całkowite 0-7. Pusta lista = limit czasu = 0 rund.
- Bez ruchu `progress` (jak Sekwencja); dodać, jeśli czekanie na rywali okaże się nudne.

## Kroki (osobne commity)

1. **Ustalenia**: sekcja `### Śledzenie (`sledzenie`)` i wiersz tabeli w `ZASADY-GIER.md`; dopisek „Śledzenie” do listy gier, w których wynik liczy serwer.
2. **Testy** `packages/games/src/sledzenie.test.ts` (wzór: `stoj.test.ts`, `kropki.test.ts`; `send`, gracze `A`/`B`/`C`, nagłówek z listą zasad):
   - definicja, setup (20 rund po 8 kulek, różne seedy różne, ten sam seed to samo, rewanż inne wyzwanie),
   - `position`: zawsze w `[RADIUS, 1 − RADIUS]` (próbkowanie co 50 ms), brak nakładania przy `t = 0` i `t = MOVE_MS`, późniejsza runda przebywa dłuższą drogę,
   - liczenie: komplet 3 rund + błąd w 4. daje `rounds 3`; kolejność wskazań bez znaczenia; `hits` 0/1/2; rundy po błędzie ignorowane; 20/20,
   - walidacja: obcy gracz, drugi wynik, 2 albo 4 wskazania, powtórzony indeks, indeks −1 i 8 (0 i 7 przechodzą), 21 rund, po końcu gry,
   - schemat: zły typ, brak pola, liczba niecałkowita,
   - koniec: wygrana każdego gracza, remis rozstrzygnięty `hits`, pełny remis i solo bez zwycięzcy, `waitingFor` kurczy się i jest puste,
   - `timeoutMove` przechodzi `validateMove` i daje 0; `applyMove` nie mutuje, stan przeżywa JSON.
3. **Zasady** `packages/games/src/sledzenie.ts` (ok. 80 linii, szkielet z `kropki.ts`), wpis w `GAMES` i eksporty w `index.ts`
   (`SledzenieView`, `SLEDZENIE_*` stałe, `position as sledzeniePosition`); `index.test.ts` poprawić tylko, jeśli liczy gry (tak było przy Stój!).
4. **Ekran** `apps/web/src/games/Sledzenie.tsx` + podpięcie:
   - fazy `intro → wait → show → move → pick → reveal → sent` na `setTimeout` (wzór `Kropki.tsx`);
     w `move` pętla `requestAnimationFrame` ustawia `style.transform` kulek z `sledzeniePosition(ball, round, performance.now() − start)`,
     bez stanu Reacta na klatkę; po `MOVE_MS` kulki lądują dokładnie w pozycji końcowej,
   - kwadratowy kafel `.tile` jak w Kropkach (`max-w-[calc(100dvh-…)]`), kulki `bg-fg`, w `show` cele w kolorze gracza;
     w `pick` dotknięcie (`onPointerDown`, `touch-none select-none`, pole dotyku min. 48 px mimo mniejszej kulki) zaznacza kolorem gracza,
     ponowne odznacza, trzecie zatwierdza,
   - `reveal` 1 s: prawdziwe cele z pierścieniem, złe wskazania przygaszone, przy błędzie `navigator.vibrate?.(60)`; potem następna runda albo wynik,
   - `Stats`: „Runda n” i „Teraz: Patrz / Śledź / Wskaż”; koniec: `Scores` z „7 rund” (+ trafione w ostatniej, jeśli > 0),
   - `Intro` z `Preview` (kilka kropek, 3 migają przez `preview-half`); bez nowych keyframes,
   - ruch kulek to treść gry, więc działa także przy `prefers-reduced-motion` (odnotować w `ZASADY-GIER.md`),
   - `screens/Game.tsx`: gałąź z `key={JSON.stringify(view.rounds[0])}` i wpis w `MINI_GAMES`; `screens/Lobby.tsx`: ikona `CirclesThree`, zdanie w `BLURBS`.
5. **Opis** w `KONCEPT.md`: punkt w 2.4, limit 300 s w regułach platformy, „12 sztuk” w tabeli etapów.

## Weryfikacja

- `pnpm --filter @mini-games/games exec vitest run src/sledzenie.test.ts` (po kroku 2 czerwone, po kroku 3 zielone), potem `pnpm typecheck && pnpm test`.
- `/dev?n=2` i solo w przeglądarce (Playwright, 360×640): pełna partia, pomyłka w 1. rundzie, remis, rewanż (inne kulki), odświeżenie w trakcie,
  obserwator, limit czasu; kulki u obu graczy lecą tak samo, pola dotyku nie nachodzą na siebie po zatrzymaniu.
