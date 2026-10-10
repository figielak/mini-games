# Nowa mini-gra: Rytm (`rytm`)

## Kontekst

Kolejna mini-gra z grupy „Szybkie i refleksowe”: metronom gra kilka uderzeń i cichnie, gracz stuka dalej w tym samym
tempie przez 10 s. Wynik = średnia odchyłka w ms, mniej lepiej. Proces według `ZASADY.md`:
ustalenia → testy → zasady → ekran → opis, każdy krok osobnym commitem (commit dopiero na prośbę).

Ustalone z użytkownikiem:
- sygnał metronomu: **błysk + wibracja + dźwięk** (pierwsza gra z dźwiękiem, klik z WebAudio, bez nowych zależności),
- metronom gra **8 uderzeń** (2 takty po 4), tempo losuje serwer,
- odchyłka liczona z **odstępów między stuknięciami**, nie od idealnej siatki.

Uwaga: w drzewie roboczym leży niezacommitowana Wieża w tych samych plikach (`index.ts`, `index.test.ts`, `Game.tsx`,
`ZASADY-GIER.md`). Rytm dopisuję obok, niczego z niej nie ruszam; liczniki („19 gier”, „13 sztuk”) podbijam o 1 względem
stanu zastanego w chwili edycji.

## Zasady (trafią do `ZASADY-GIER.md`)

- `id` `rytm`, nazwa „Rytm”, 1-6 graczy, mini-gra, `turnSeconds: 60` (najdłuższa partia: 1 s wstępu + 8 × 857 ms + 10 s ≈ 18 s).
- Stałe: `BEATS = 8`, `TAP_MS = 10_000`, `BPM_MIN = 70`, `BPM_MAX = 130`, `BPM_STEP = 5`, `MAX_TAPS = 60`.
- Serwer losuje w `setup` tempo (13 wartości) i zapisuje `interval = round(60000 / bpm)` ms (462-857), to samo dla wszystkich,
  oraz `nonce` (jak Stoper: przy 13 tempach rewanż mógłby wylosować to samo i ekran by się nie zamontował od nowa).
- Jeden ruch `{ type: "result", taps: number[] }`: czasy stuknięć w ms (int) od **ostatniego uderzenia metronomu**.
  Stuknięcia przed ostatnim uderzeniem i po 10 s ekran ignoruje.
- Wynik liczy serwer funkcją `deviation(interval, taps)`:
  - odstępy = różnice kolejnych czasów w `[0, ...taps]` (pierwszy odstęp liczy się od ostatniego uderzenia metronomu),
  - błąd odstępu = `|odstęp − interval|`, ucięty do `interval`,
  - oczekiwana liczba odstępów `expected(interval) = floor(TAP_MS / interval) − 1` (jedno uderzenie zapasu: kto gra odrobinę
    za wolno, nie traci ostatniego stuknięcia o włos),
  - brakujące odstępy (mniej stuknięć niż oczekiwano) liczą się jak najgorsze, czyli `interval`,
  - wynik = `round(suma / max(expected, liczba odstępów))`, zakres `0..interval`.
- Skutki: pominięte uderzenie daje odstęp 2× i pełny błąd; klepanie na oślep daje błąd bliski `interval`; dwa idealne stuknięcia
  i koniec nie wygrywają.
- Ranking: mniejsza odchyłka wyżej, równe = remis bez zwycięzcy (`rankResults`).
- Walidacja: gracz z gry, bez wyniku, najwyżej `MAX_TAPS` czasów, każdy całkowity `1..TAP_MS`, ściśle rosnące.
  Pusta lista = limit czasu = wynik `interval` (najgorszy możliwy).
- Grający nie widzi limitu tury po starcie (jak w Stoperze: pasek tykający co sekundę podawałby tempo 60 BPM); z tego samego powodu
  ekran stukania nie ma licznika sekund, tylko płynny pasek.
- Odstępstwo od „bez dźwięku”: metronom klika. Bez gestu (autostart po 15 s instrukcji) albo przy wyciszonym telefonie zostaje
  błysk i wibracja; gra musi być grywalna z samym błyskiem.

## Kroki (osobne commity)

1. **Ustalenia**: `plany/rytm.md` (ten plan), sekcja `### Rytm (`rytm`)` i wiersz tabeli w `ZASADY-GIER.md`; dopisek „Rytm” do listy
   gier, w których wynik liczy serwer, i do zdania o `nonce`.
2. **Testy** `packages/games/src/rytm.test.ts` (wzór: `stoj.test.ts`: `accepts`, `send`, gracze `A`/`B`/`C`, nagłówek z listą zasad):
   - definicja; setup (tempo z listy 70-130 co 5, różne seedy dają różne tempa, ten sam seed to samo, rewanż ma inny `nonce`),
   - `deviation`: idealne stukanie = 0; stale o 20 ms za szybko = 20; pierwszy odstęp liczony od zera; pominięte uderzenie = jeden
     odstęp z pełnym błędem; za mało stuknięć dolicza `interval` za każde brakujące; odstęp dłuższy niż 2× ucięty do `interval`;
     więcej stuknięć niż oczekiwano dzieli przez ich liczbę; pusta lista = `interval`; klepanie co 50 ms gorsze niż 0,8 × `interval`;
     `expected` dla skrajnych temp,
   - walidacja: obcy gracz, drugi wynik, po końcu gry, czas 0 i `TAP_MS + 1` odpadają (1 i `TAP_MS` przechodzą), czasy nierosnące
     i równe, `MAX_TAPS` przechodzi a `MAX_TAPS + 1` nie,
   - schemat: czas niecałkowity, tekstem, brak listy, zły typ ruchu,
   - koniec: wygrana każdego z trzech, remis bez zwycięzcy, solo bez zwycięzcy, `waitingFor` kurczy się i jest puste,
   - `timeoutMove` przechodzi `validateMove` i daje `interval`; `applyMove` nie mutuje, stan przeżywa JSON.
   Pomocnik `steady(interval, offset = 0, n = expected)` buduje listę stuknięć, bez wpisanych liczb.
3. **Zasady** `packages/games/src/rytm.ts` (ok. 60 linii, szkielet ze `stoper.ts`; `results: Record<PlayerId, number>`),
   wpis w `GAMES` i eksporty w `index.ts` (`RytmView`, `RYTM_BEATS`, `RYTM_TAP_MS`, `rytmExpected`); licznik gier w `index.test.ts` +1.
4. **Ekran** `apps/web/src/games/Rytm.tsx` + podpięcie (wzór `Stoper.tsx` i `Stoj.tsx`):
   - fazy `intro → listen → tap → sent`; `LEAD_MS = 1000` ciszy po „Start”, potem 8 uderzeń,
   - uderzenia: terminy liczone od startu (`after` jak w `Stoj.tsx`, spóźniony timer nie przesuwa kolejnych); błysk pola bez przejścia
     (pierwsze uderzenie taktu akcentem, pozostałe jaśniejszą powierzchnią), 8 kropek postępu, `navigator.vibrate?.(30)`,
   - dźwięk: `AudioContext` tworzony w `onStart` (gest), wszystkie 8 klików zaplanowane od razu na zegarze audio
     (`OscillatorNode` + `GainNode`, 30 ms, akcent wyżej); `try/catch`, zamykany przy odmontowaniu.
     `// ponytail:` opóźnienie wyjścia audio (głośnik Bluetooth) przesuwa tylko pierwszy odstęp, kalibracji nie ma,
   - stukanie: całe pole (`onPointerDown`, `touch-none select-none`, `min-h-80`), czas z `e.timeStamp` względem ostatniego uderzenia;
     stuknięcie błyska kolorem gracza przez 100 ms; płynny pasek 10 s (jedna `transition` szerokości, bez nowych keyframes);
     po 10 s `onMove({ type: "result", taps })`,
   - koniec: kafel „Twoje tempo 104 BPM, cel 100 BPM” (średni odstęp z lokalnych stuknięć, jak „Twój czas” w Stoperze)
     i `Scores` z „42 ms”,
   - `Intro` z `Preview` (kropka migająca `preview-half`), punkty: „8 uderzeń metronomu, potem cisza”, „Stukaj dalej w tym samym
     tempie przez 10 sekund”, „Liczy się średnia odchyłka odstępów, mniej znaczy lepiej”,
   - `screens/Game.tsx`: gałąź z `key={view.nonce}`, wpis w `MINI_GAMES`, ukrycie paska limitu jak dla `stoper` (linia 128);
     `screens/Lobby.tsx`: ikona `Metronome`, zdanie w `BLURBS`.
5. **Opis** w `KONCEPT.md`: punkt w 2.4, liczba mini-gier w tabeli etapów +1; w „Tryb wykładowy” dopisek, że Rytm jako jedyny gra dźwięk.

## Weryfikacja

- `pnpm --filter @mini-games/games exec vitest run src/rytm.test.ts` (po kroku 2 czerwone, po kroku 3 zielone), potem `pnpm typecheck && pnpm test`.
- `/dev?n=2` i solo w przeglądarce (Playwright, 360×640): pełna partia, wynik z ekranu zgadza się z serwerem; brak stuknięć (wynik = odstęp),
  klepanie na oślep, remis, rewanż (ekran montuje się od nowa), odświeżenie w trakcie, obserwator, autostart po 15 s (bez dźwięku, błysk działa),
  limit tury; pasek limitu niewidoczny u grającego.
- Na telefonie: czy klik, błysk i wibracja są równo, i czy tempa 70 i 130 BPM są grywalne (stałe do strojenia po partiach testowych).
