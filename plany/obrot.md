# Nowa mini-gra: Obrót (`obrot`)

## Kontekst

Kolejna mini-gra z grupy „Szybkie i refleksowe”: dwie figury z klocków obok siebie, gracz rozstrzyga, czy druga to ta sama figura
obrócona, czy jej lustrzane odbicie. 30 s, wynik = trafienia minus pomyłki.
Proces według `ZASADY.md`: ustalenia → testy → zasady → ekran → opis, każdy krok osobnym commitem (commit dopiero na prośbę).

Ustalone z użytkownikiem:
- figury **płaskie 2D** (kwadraty na siatce, jak klocki z Tetrisa), obrót o 90/180/270°,
- pomyłka = **−1 pkt i blokada 1 s** (przy dwóch odpowiedziach samo −1 nie wystarcza na klepanie na oślep).

Przebieg (30 s, pytanie, odpowiedzi, blokada, `times` + `errors`) jest ten sam co w Kolorze liter, więc gra dzieli `quiz.ts` i `Quiz.tsx`
(ZASADY.md, sekcja 3), tak jak Inny element. Inna jest tylko punktacja (jak w Stój!, z kosztem 1 zamiast 2).

W drzewie roboczym leżą niezacommitowane Wieża, Rytm i Inny element w tych samych plikach; dopisuję obok, niczego z nich nie ruszam.
Liczniki +1 względem stanu zastanego (dziś: 22 gry w `index.test.ts`, „16 sztuk” w `KONCEPT.md`).

## Zasady (trafią do `ZASADY-GIER.md`)

- `id` `obrot` (na stałe), nazwa „Obrót”, 1-6 graczy, mini-gra, `turnSeconds: 90` (jak Kolor liter).
- Serwer losuje w `setup` 200 par (`QUESTIONS` z `quiz.ts`), te same dla wszystkich. Para nr `i`: `{ a, b, mirror }`,
  gdzie `a` i `b` to listy pól `[x, y]` znormalizowane do rogu (0, 0); ekran niczego nie liczy, tylko rysuje.
- Figura `a`: losowo rosnący poliomino z `n = min(MIN_CELLS + floor(i / 3), MAX_CELLS)` klocków (`MIN_CELLS = 4`, `MAX_CELLS = 7`),
  czyli trudność rośnie co 3 pary. Figura musi być **chiralna** (odbicie nie jest żadnym z jej 4 obrotów), inaczej pytanie
  nie miałoby odpowiedzi; niechiralna jest losowana od nowa.
- `b` = `a` (albo odbicie `a`, gdy `mirror`) obrócone o losowe 90, 180 albo 270°. `mirror` losowane po równo.
- Jeden ruch `{ type: "result", times, errors }` (`QuizMove`): czasy trafień i liczba pomyłek.
- Pomyłka: blokada 1 s i następna para (jak w Kolorze liter, bez `retry`: przy dwóch odpowiedziach druga próba byłaby darmowa).
- Wynik = trafienia − pomyłki, nie mniej niż 0, więcej lepiej. Przy remisie niższa średnia czasu trafień; dwa wyniki bez trafień
  to remis; równe = bez zwycięzcy (`rankResults`).
- Walidacja wspólna (`validQuiz`): czasy 150-5000 ms, suma ≤ 30 s, najwyżej 200. Limit czasu: zero trafień, zero pomyłek.
- `// ponytail:` wynik liczy klient jak w Kolorze liter; serwer zna `mirror`, więc mógłby liczyć sam z listy odpowiedzi, gdyby ktoś zaczął oszukiwać.
- Stałe (`MIN_CELLS`, `MAX_CELLS`, krok co 3 pary, same kąty proste) do strojenia po partiach testowych.

## Kroki (osobne commity)

1. **Ustalenia**: `plany/obrot.md` (ten plan), sekcja `### Obrót (`obrot`)` i wiersz tabeli w `ZASADY-GIER.md`;
   w sekcji Koloru liter dopisek, że `quiz.ts` i `Quiz.tsx` dzieli też Obrót.
2. **Testy** `packages/games/src/obrot.test.ts` (wzór: `inny.test.ts`, nagłówek z listą zasad, gracze `A`/`B`/`C`, `send`):
   - definicja (1-6, 90 s, świeża gra nieskończona); setup: 200 par, różne seedy różne, ten sam seed to samo,
   - figury: `a` i `b` mają tyle samo klocków, 4 na parach 0-2, potem +1 co 3 pary do 7; pola całkowite, bez powtórek, spójne
     (każdy klocek styka się bokiem z innym), znormalizowane (min x = min y = 0),
   - odpowiedź jest jednoznaczna: gdy `!mirror`, `b` jest jednym z 4 obrotów `a` i żadnym obrotem odbicia; gdy `mirror`, odwrotnie
     (pomocnik w teście z własnym obrotem i odbiciem, niezależny od implementacji),
   - `b` nigdy nie jest identyczne z `a` (obrót 0° nie występuje); obie odpowiedzi występują mniej więcej po równo,
   - punktacja: trafienia − pomyłki wygrywa z większą liczbą trafień i wieloma pomyłkami; wynik nie spada poniżej 0;
     remis punktów rozstrzyga średnia; dwa puste wyniki to remis,
   - walidacja, schemat, koniec gry (wygrana każdego z trzech), solo, `timeoutMove`, niemutowanie i JSON: jak w `inny.test.ts`.
   - `index.test.ts`: liczba gier 22 → 23.
3. **Zasady**:
   - `packages/games/src/core.ts`: `byScoreThenAverage(score)` (porównanie wyciągnięte ze `stoj.ts`: więcej punktów wyżej, potem niższa
     średnia, dwa wyniki bez trafień to remis); `stoj.ts` używa go zamiast własnego `compare`. Testy Stój! bez zmian.
   - `packages/games/src/obrot.ts` (ok. 60 linii, szkielet z `inny.ts`): `score`, `setup` z parami (lokalne `rotate`, `flip`, `normalize`
     na listach pól, losowy wzrost figury przez dokładanie sąsiada z `rng`), reszta to `quizMoveSchema`, `validQuiz`, `rankResults`.
   - `index.ts`: wpis w `GAMES`, eksport `ObrotView` i `obrotScore`.
4. **Ekran** + podpięcie:
   - `apps/web/src/games/Quiz.tsx`: trzy opcjonalne propsy, bez zmiany zachowania pozostałych gier: `points` (funkcja wyniku: etykieta
     „Punkty” w `Stats` i przekazanie do `Results`, które już to umie), `note` (do `Results`) i `score` (tekst punktacji w `Intro`).
   - `apps/web/src/games/Obrot.tsx` (wzór `Inny.tsx`, ok. 50 linii): `Figure` = jeden `<svg>` z `<rect>` na każde pole
     (`viewBox` z rozmiaru figury, wypełnienie tokenem `fg`, stała skala klocka, żeby rozmiar nie zdradzał odpowiedzi);
     `question(i)` zwraca `prompt` z dwiema figurami obok siebie i dwie odpowiedzi: „Ta sama” (ikona `ArrowsClockwise`) i „Lustro” (`FlipHorizontal`).
     `Preview` przez `QuizPreview`: mała para figur, odpowiedzi „ta sama” / „lustro”.
     Teksty: zadanie „Dwie figury z klocków: ta sama obrócona czy lustrzane odbicie?”, punktacja „Trafienie to punkt, pomyłka zabiera punkt i blokuje na sekundę”,
     notka „Punkty to trafienia minus błędy. Przy remisie wygrywa niższy średni czas.”
   - `screens/Game.tsx`: gałąź jak dla `inny` (`key` z `trials.map((t) => +t.mirror).join("")`, `onRound={setInRound}`), wpis w `MINI_GAMES`;
     `screens/Lobby.tsx`: ikona `ArrowsClockwise` w `ICONS`, zdanie w `BLURBS`
     („Dwie figury z klocków: ta sama obrócona czy lustrzane odbicie? 30 s, pomyłka zabiera punkt.”).
   - Bez nowych keyframes i klas w `index.css`, bez nowych zależności.
5. **Opis** w `KONCEPT.md`: punkt w 2.4, dopisek przy „dzielą `quiz.ts` i `Quiz.tsx`”, limit 90 s w regułach platformy, liczba mini-gier 16 → 17.

## Weryfikacja

- `pnpm --filter @mini-games/games exec vitest run src/obrot.test.ts` (po kroku 2 czerwone, po kroku 3 zielone), potem `pnpm typecheck && pnpm test`.
- `/dev?n=2` i solo (Playwright, 360×640): pełna partia, figura 7 klocków mieści się obok drugiej bez poziomego przewijania, przyciski ≥ 48 px;
  pomyłka blokuje na 1 s i odejmuje punkt w pasku; wynik z ekranu zgadza się z tabelą; remis, rewanż (inne pary, ekran od nowa),
  odświeżenie w trakcie, obserwator, autostart po 15 s, limit tury.
- Regresja: po jednej partii Koloru liter, Innego elementu i Stój! (wyniki i ranking bez zmian).
- Po partiach testowych: czy 4 klocki nie są za łatwe, a 7 za trudne (stałe do strojenia).
