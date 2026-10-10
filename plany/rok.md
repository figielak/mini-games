# Nowa mini-gra: Który rok? (`rok`)

## Kontekst

Trzynasta mini-gra: na ekranie wydarzenie historyczne, wynalazek albo premiera, gracz ustawia rok suwakiem. 10 rund,
wynik to suma odchyłek w latach (mniej lepiej). Mechanicznie bliźniak Policz kropki (10 rund, liczba całkowita, suma błędów
liczona na serwerze), więc szkielet idzie z `kropki.ts` / `Kropki.tsx`, a suwak z `Kolor.tsx`.
Proces według `ZASADY.md`: ustalenia → testy → zasady → ekran → opis, każdy krok osobnym commitem (commit dopiero na prośbę).

Ustalone z użytkownikiem: zakres 1900-2025, pula z czterech działów (historia świata, historia Polski, wynalazki i technologia,
premiery popkultury), 20 s na rundę.

## Zasady (trafią do `ZASADY-GIER.md`)

- `id` `rok`, nazwa „Który rok?”, 1-6 graczy, mini-gra.
- Stałe: `ROUNDS = 10`, `MIN_YEAR = 1900`, `MAX_YEAR = 2025`, `ROUND_MS = 20000`, `REVEAL_MS = 2500`.
  Limit partii 240 s (10 × 22,5 s plus zapas), przez `turn()` ze stałym kluczem jak w Kropkach.
- Pula `EVENTS: { text: string; year: number }[]` w `rok.ts` (ok. 150 pozycji, po równo z czterech działów, wzór: `CARDS` w `kampus-tour.ts`).
  Tylko wydarzenia z jednoznacznym rokiem (bez „lata 60.”, bez sporów o datę; premiera = rok pierwszej premiery), tekst nie zdradza roku.
  Lista do przejrzenia przez użytkownika w kroku 3.
- `setup`: `shuffle(EVENTS, rng).slice(0, ROUNDS)` (`shuffle` z `core.ts`), to samo 10 wydarzeń dla wszystkich. Lata są w widoku od startu
  (jak kropki i cele w Odcieniu, komentarz `ponytail:`).
- Ruch `{ type: "result", answers: number[] }`: 10 liczb całkowitych `MIN_YEAR`-`MAX_YEAR` albo pusta lista (limit partii).
  Wynik liczy serwer: suma `|odpowiedź − rok|`. Pusta lista = suma najgorszych możliwych błędów, czyli `max(rok − MIN_YEAR, MAX_YEAR − rok)` w każdej rundzie.
- Ruch `{ type: "progress", done }` (int 1-9) po każdej rundzie poza ostatnią, jak w Kropkach: pasek „3/10” w pigułce gracza, nie odnawia limitu.
- Limit rundy 20 s jest na kliencie (jak cała partia mini-gry): po czasie zatwierdza się rok ustawiony na suwaku. Suwak startuje na środku (1962).
- Ranking: `rankResults` (mniejsza suma wyżej), remis i solo bez zwycięzcy.

## Kroki (osobne commity)

1. **Ustalenia**: sekcja `### Który rok? (`rok`)` i wiersz tabeli w `ZASADY-GIER.md` (dopiski w sekcji 1: lista gier z `progress`
   i lista gier z wynikiem liczonym na serwerze); ten plan jako `plany/rok.md` (wzór: `plany/sledzenie.md`).
2. **Testy** `packages/games/src/rok.test.ts` (wzór: `kropki.test.ts`; `send`, gracze `A`/`B`/`C`, nagłówek z listą zasad):
   - definicja (1-6, `turn()` ze stałym kluczem, świeża gra nieskończona), setup (10 różnych wydarzeń, różne seedy różne, ten sam seed to samo),
   - pula: co najmniej 100 pozycji, każdy rok int w `MIN_YEAR`-`MAX_YEAR`, teksty niepuste, bez powtórek i bez czterocyfrowej liczby w tekście,
   - liczenie: bezbłędnie = 0, błędy w obie strony się sumują, pusta lista = suma najgorszych błędów, odpowiedzi zostają w stanie,
   - walidacja: obcy gracz, drugi wynik, 9 i 11 odpowiedzi, 1899 i 2026 odpadają (1900 i 2025 przechodzą), ułamek, po końcu gry,
   - `progress`: 0, 10 i ułamek odpadają, widzą go wszyscy (także `""`), nie zmienia `waitingFor`, może spaść, nie zmienia `turn().key`,
   - schemat: zły typ, brak pola, 11 odpowiedzi, nieznany `type`,
   - koniec: wygrana każdego gracza, remis i solo bez zwycięzcy, `waitingFor` kurczy się i jest puste,
   - `timeoutMove` przechodzi `validateMove`; `applyMove` nie mutuje, stan przeżywa JSON.
3. **Zasady** `packages/games/src/rok.ts` (logika ok. 60 linii z `kropki.ts` + pula), wpis w `GAMES` i eksporty w `index.ts`
   (`RokView`, `ROK_ROUNDS`, `ROK_MIN_YEAR`, `ROK_MAX_YEAR`, `ROK_ROUND_MS`); `index.test.ts` poprawić tylko, jeśli liczy gry.
4. **Ekran** `apps/web/src/games/Rok.tsx` + podpięcie:
   - fazy `intro → answer → reveal → sent` na `setTimeout` (wzór `Kropki.tsx`);
   - `answer`: `Stats` („Runda n/10”, „Suma błędów”), kafel z tekstem wydarzenia, duży rok czcionką mono, `<input type="range">`
     (ten sam styl co w `Kolor.tsx:191`) i przyciski `−1` / `+1` (48 px, `aria-label`), „Zatwierdź” w kolorze gracza;
     pasek czasu rundy to `div` z `transition-[width]` na 20 s (bez nowych keyframes, `key` z numeru rundy), `setTimeout(ROUND_MS)` zatwierdza sam,
   - `reveal` (2,5 s, potem sama następna runda): „Było 1969, ustawiłeś 1975”, różnica ze znakiem (`signed` jak w Kropkach), „Idealnie” na zielono przy 0,
     na torze suwaka znacznik prawdziwego roku; przy błędzie nic nie wibruje (to nie pomyłka w grze na czas),
   - `sent` / koniec: `Scores` (suma w latach) i lista 10 wydarzeń z prawdziwym rokiem oraz odpowiedzią każdego gracza w jego kolorze
     (w trakcie tylko własne, po końcu wszystkich, jak `Answers` w Kropkach),
   - `Intro` z `Preview` (rok i suwak na przemian przez `preview-half`),
   - `screens/Game.tsx`: gałąź z `key={JSON.stringify(view.events)}`, wpis w `MINI_GAMES`, pigułka postępu wspólna z Kropkami;
     `screens/Lobby.tsx`: ikona `CalendarBlank`, zdanie w `BLURBS`.
5. **Opis** w `KONCEPT.md`: punkt w 2.4, limit 240 s w regułach platformy, gry z `progress`, „13 sztuk” w tabeli etapów.

## Weryfikacja

- `pnpm --filter @mini-games/games exec vitest run src/rok.test.ts` (po kroku 2 czerwone, po kroku 3 zielone), potem `pnpm typecheck && pnpm test`.
- `/dev?n=2` i solo w przeglądarce (Playwright, 360×640): pełna partia, runda dobiegająca 20 s, remis, rewanż (inne wydarzenia),
  odświeżenie w trakcie, obserwator, limit partii; suwak i przyciski ±1 trafiają w każdy rok 1900-2025, najdłuższy tekst wydarzenia mieści się w kaflu.
