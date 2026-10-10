# Nowa mini-gra: Kąt (`kat`)

## Kontekst

Kolejna mini-gra z grupy „Szybkie i refleksowe”: na chwilę widać kąt, potem gracz wpisuje jego miarę w stopniach. 10 rund,
wynik = suma odchyłek w stopniach (mniej lepiej), liczona na serwerze. Mechanicznie to bliźniak Policz kropki
(pokaz → wpisanie liczby → porównanie, 10 rund, `result` + `progress`).
Proces według `ZASADY.md`: ustalenia → testy → zasady → ekran → opis, każdy krok osobnym commitem (commit dopiero na prośbę).

Ustalone z użytkownikiem:
- kąty **5-175°** (bez wklęsłych, więc bez oznaczania mierzonej strony),
- rysunek: **wierzchołek na środku, równe ramiona, losowy obrót** całego kąta,
- **wspólny ekran** z Policz kropki (ZASADY.md, sekcja 3), Kropki i Kąt to cienkie nakładki (wzór: `Quiz.tsx` + `Stroop.tsx`).

Jestem na gałęzi `obrot`; pracuję na nowej gałęzi `kat` od niej. `plany/mapa.md` (nieśledzony) zostaje nietknięty.
Liczniki +1 względem stanu zastanego (23 gry w `index.test.ts`, „17 sztuk” w `KONCEPT.md`).

## Zasady (trafią do `ZASADY-GIER.md`)

- `id` `kat` (na stałe), nazwa „Kąt”, 1-6 graczy, mini-gra, bez trybów, `turnSeconds: 120` (jak Policz kropki).
- Serwer losuje w `setup` 10 rund, te same dla wszystkich. Runda: `{ angle, rotation }`, obie liczby całkowite w stopniach:
  `angle` z `MIN`-`MAX` (5-175), `rotation` 0-359 (kierunek pierwszego ramienia; drugie to `rotation + angle`).
- Kąt widać `SHOW_MS = 1500` ms, potem gracz wpisuje miarę.
- Jeden ruch `{ type: "result", answers }` z 10 odpowiedziami (int 0-`MAX_ANSWER`, czyli 0-180) albo pustą listą (limit czasu).
  Wynik liczy serwer: suma |odpowiedź − kąt|, mniej lepiej, bez tolerancji; remis = bez zwycięzcy (`rankResults`).
- Pusta lista = w każdej rundzie najgorszy możliwy błąd, `max(kąt, 180 − kąt)` (jak w Który rok?, nie jak zera w kropkach:
  zero przy kącie 10° byłoby prawie trafieniem).
- Ruch `progress` (`done` int 1-9) po każdej odpowiedzi poza ostatnią: podgląd w pigułkach, `turn` ze stałym kluczem `run`, może spaść.
- Rundy są w widoku od startu: `// ponytail:` da się podejrzeć, między znajomymi wystarczy (jak kropki).
- Stałe (`MIN`, `MAX`, `SHOW_MS`) do strojenia po partiach testowych.

## Kroki (osobne commity)

1. **Ustalenia**: `plany/kat.md` (ten plan), sekcja `### Kąt (`kat`)` i wiersz tabeli w `ZASADY-GIER.md`; dopisek „Kąt” na listach
   w sekcji 1 (gry z `progress`, gry z wynikiem liczonym na serwerze); w sekcji Policz kropki zdanie, że ekran dzieli z Kątem.
2. **Testy** `packages/games/src/kat.test.ts` (wzór: `kropki.test.ts` + przypadek limitu z `rok.test.ts`; nagłówek z listą zasad, `A`/`B`/`C`, `send`):
   - definicja (1-6, 120 s, świeża gra trwa); setup: 10 rund, `angle` int 5-175, `rotation` int 0-359, różne seedy różne, ten sam seed to samo,
   - walidacja: za mało / za dużo odpowiedzi, −1, 181, ułamek odpadają; 0 i 180 przechodzą; obcy gracz, drugi wynik, pusta lista przechodzi,
   - wynik: bezbłędnie = 0, błędy w obie strony się sumują, pusta lista = suma `max(kąt, 180 − kąt)`, odpowiedzi zostają w stanie,
   - koniec: wygrana każdego z trzech, remis bez zwycięzcy, solo bez zwycięzcy, `waitingFor` puste, `timeoutMove` przechodzi `validateMove`,
   - `progress`: jak w `kropki.test.ts` (widzą wszyscy i obserwator, nie kończy gry, może spaść, 0 / 10 / ułamek odpadają, stały klucz `turn`),
   - schemat odrzuca śmieci; `applyMove` nie mutuje; stan przeżywa JSON,
   - `index.test.ts`: liczba gier 23 → 24.
3. **Zasady** `packages/games/src/kat.ts` (ok. 60 linii, szkielet 1:1 z `rok.ts`: schemat, `validateMove`, `applyMove` z `worst`, `rankResults`);
   `index.ts`: wpis w `GAMES`, eksport `ROUNDS as KAT_ROUNDS`, `SHOW_MS as KAT_SHOW_MS`, `MAX_ANSWER as KAT_MAX_ANSWER`, `type View as KatView`.
   `// ponytail:` szkielet zasad to trzecia kopia (kropki, rok, kat); wspólny moduł, gdy dojdzie czwarta albo zmieni się kształt ruchu.
4. **Ekran** + podpięcie:
   - `apps/web/src/games/Szacowanie.tsx` (nowy): cały przebieg z dzisiejszego `Kropki.tsx` przeniesiony bez zmian zachowania
     (fazy `intro/wait/show/answer/reveal/sent`, `WAIT_MS`, formularz, `Answers`, `signed`, `Scores`, licznik rundy i sumy błędów).
     Propsy ponad wspólne (`view` o kształcie `{ players, results, answers, progress }`, `me`, `players`, `ranking`, `onMove`):
     `truths: number[]`, `draw(index, reveal)` (zawartość kafla), `showMs`, `maxAnswer` (liczba cyfr pola i blokada „Zatwierdź” powyżej),
     `unit` (`""` albo `"°"`), `question` („Ile było kropek?”), oraz `preview`, `time`, `task`, `score` do `Intro`.
   - `Kropki.tsx`: zostaje `PREVIEW_DOTS`, `Preview` i nakładka przekazująca kropki do `draw` (ok. 40 linii). Teksty i wygląd bez zmian.
   - `apps/web/src/games/Kat.tsx` (ok. 50 linii): `draw` = `<svg viewBox="0 0 100 100">`, dwa `<line>` z (50, 50) długości 40
     (`stroke-fg`, zaokrąglone końce); w fazie `reveal` dodatkowo łuk przy wierzchołku. `Preview`: mały kąt i „Ile°?” na `preview-half`.
     Teksty: czas „10 rund, kąt widać przez 1,5 s”, zadanie „Wpisz jego miarę w stopniach”,
     punktacja „Liczy się suma pomyłek (było 70°, wpisujesz 62°: 8 punktów), mniej znaczy lepiej”; odsłona „Było 70°, wpisałeś 62°”.
   - `screens/Game.tsx`: gałąź `kat` jak `kropki` (`key` z `JSON.stringify(rounds)`), wpis w `MINI_GAMES`; pasek postępu w pigułce:
     warunek `kropki` rozszerzony o `kat` (ten sam kształt widoku, obie gry mają 10 rund).
   - `screens/Lobby.tsx`: ikona `Angle` (Phosphor, jest w paczce) w `ICONS`, zdanie w `BLURBS`
     („Kąt miga przez 1,5 s, wpisujesz jego miarę w stopniach. 10 rund, wygrywa najmniejsza suma błędów.”).
   - Bez nowych keyframes, klas w `index.css` i zależności.
5. **Opis** w `KONCEPT.md`: punkt w 2.4, „Kąt” przy grach z `progress` i przy limicie 120 s, zdanie o wspólnym `Szacowanie.tsx`,
   liczba mini-gier 17 → 18.

## Weryfikacja

- `pnpm --filter @mini-games/games exec vitest run src/kat.test.ts` (po kroku 2 czerwone, po kroku 3 zielone), potem `pnpm typecheck && pnpm test`.
- `/dev?n=2` i solo (Playwright, 360×640): pełna partia, klawiatura numeryczna nie zasłania „Zatwierdź”, 181 nie da się zatwierdzić,
  odsłona pokazuje kąt z łukiem i różnicę ze znakiem, suma na ekranie zgadza się z tabelą; pigułki pokazują „3/10”;
  remis, rewanż (inne kąty, ekran od nowa), odświeżenie w trakcie, obserwator, autostart po 15 s, limit tury (wynik = suma najgorszych błędów).
- Regresja: pełna partia Policz kropki po przeniesieniu ekranu (teksty, układ, odsłona, tabela odpowiedzi, pigułki bez zmian).
- Po partiach testowych: czy 1,5 s i zakres 5-175° są dobre (stałe do strojenia).
