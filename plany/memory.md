# Nowa gra: Memory (`memory`)

## Kontekst

Klasyczne Memory na wspólnej planszy: gracze po kolei odkrywają po dwie karty, para zostaje u gracza i daje kolejny ruch.
Typ „po kolei” z ukrytym stanem (układ kart zna tylko serwer), więc szkielet idzie z `piec-w-rzedzie.ts`, tryby z `statki.ts`.
Proces według `ZASADY.md`: ustalenia → testy → zasady → ekran → opis, każdy krok osobnym commitem (commit dopiero na prośbę).

Ustalone z użytkownikiem: gra po kolei na wspólnej planszy, trzy rozmiary jako tryby w lobby, na kartach ikony Phosphor,
po pudle karty widać 1,5 s, a tura od razu przechodzi dalej.

Uwaga: w drzewie roboczym leży niezacommitowana Wieża (`wieza.ts`, zmiany w `index.ts`, `index.test.ts`, `ZASADY-GIER.md`).
Memory dopisuje się obok, plików Wieży nie rusza.

## Zasady (trafią do `ZASADY-GIER.md`, sekcja „7. Memory (`memory`)”)

- `id` `memory`, nazwa „Memory”, 2-6 graczy, `turnSeconds: 60` (na każde odkrycie karty, jak każdy ruch w grach po kolei).
- Tryby (`MODES` w `memory.ts`, wzór `statki.ts`; jeden ranking):

  | Tryb | Plansza | Pary |
  |---|---|---|
  | `mala` (Mała) | 4×4 | 8 |
  | `srednia` (Średnia, domyślna) | 4 kolumny × 6 rzędów | 12 |
  | `duza` (Duża) | 6×6 | 18 |

- Stała `SYMBOLS = 18`. `setup`: `shuffle` (core.ts) z 18 symboli bierze tyle, ile par, podwaja i tasuje jeszcze raz.
  Zaczyna `players[0]`.
- Jeden ruch `{ card: number }` (indeks karty). Dozwolony: tura gracza, indeks całkowity w planszy, karta zakryta
  i nie jest pierwszą kartą tej tury.
- Pierwsza karta tury zostaje odkryta (`first`). Druga:
  - para: obie karty dostają właściciela, ten sam gracz rusza dalej,
  - pudło: `miss = { cards, faces }`, tura przechodzi na następnego gracza. `miss` znika przy następnym odkryciu.
- Koniec, gdy wszystkie pary zebrane. Ranking po liczbie par przez `rankResults` (core.ts): remis na górze = bez zwycięzcy.
- `timeoutMove`: losowa zakryta karta (inna niż `first`).
- **Ukrywanie**: `playerView` (ten sam dla każdego, także `""`) zawiera symbole tylko kart zebranych, `first` i `miss`.
  Symbol z `miss` zostaje w widoku do następnego ruchu, choć ekran zakrywa karty po 1,5 s (i tak każdy je widział).
- Widok: `{ mode, cols, players, turn, faces: (number | null)[], owner: (PlayerId | null)[], first, miss }`.

## Kroki (osobne commity)

1. **Ustalenia**: sekcja i wiersz tabeli w `ZASADY-GIER.md`; ten plan jako `plany/memory.md` (wzór `plany/wieza.md`).
2. **Testy** `packages/games/src/memory.test.ts` (wzór `piec-w-rzedzie.test.ts` i `statki.test.ts`; `send`, gracze `A`/`B`/`C`,
   nagłówek z listą zasad). Układ kart test odczytuje pomocnikiem ze stanu po `setup` (szuka pary / nie-pary), nie wpisuje go ręcznie.
   - definicja (2-6, 60 s, trzy tryby, nieznany tryb = `srednia`), setup (każdy symbol dokładnie 2 razy, liczba kart per tryb,
     różne seedy różnie, ten sam seed tak samo, zaczyna `players[0]`),
   - walidacja: obcy, nie swoja tura, indeks −1 i `n` odpadają (0 i `n − 1` przechodzą), ułamek, karta zebrana,
     ta sama karta drugi raz, ruch po końcu,
   - schemat: zły typ, brak pola, ułamek,
   - zasady: para daje kartę właścicielowi i kolejny ruch; pudło oddaje turę następnemu (przy 3 graczach kolejka się zawija);
     `miss` znika po następnym odkryciu,
   - ukrywanie: widok gracza i `""` nie zawiera symboli zakrytych kart (start, po pierwszej karcie, po pudle, po parze);
     widać dokładnie `first`, `miss` i zebrane,
   - koniec: wygrana każdego z graczy, remis bez zwycięzcy, ranking 3 graczy w kolejności par, `waitingFor` puste,
   - `timeoutMove` przechodzi `validateMove` (także z odkrytą pierwszą kartą); `applyMove` nie mutuje, stan przeżywa JSON.
3. **Zasady** `packages/games/src/memory.ts` (ok. 100 linii), wpis w `GAMES` i eksport `MemoryView`, `MEMORY_SYMBOLS` w `index.ts`;
   licznik gier w `index.test.ts` +1.
4. **Ekran** `apps/web/src/games/Memory.tsx` + podpięcie:
   - siatka `cols` kolumn z `view`, karta to `button` (min. 48 px; przy 6 kolumnach na 360 px wychodzi ok. 52 px),
     proporcje karty w trybie 4×6 dobrane tak, żeby plansza z nagłówkiem mieściła się na 360×640,
   - `ICONS`: 18 ikon Phosphor po indeksie symbolu (wyraźnie różne sylwetki), `aria-label` „Karta 5, zakryta / kot”,
   - odkrycie: obrót karty przez `transition-transform` 180 ms (bez nowych keyframes); zebrana para ma obwódkę i tło
     w kolorze właściciela, świeżo zebrana `stone-pop`,
   - pudło: stała `MISS_MS = 1500`; `useEffect` na `view.miss` z `setTimeout` zakrywa karty lokalnie, wcześniejszy ruch rywala
     zakrywa je od razu (animacja nie blokuje gry); wibracji brak (moją turę sygnalizuje `Game.tsx`),
   - pod planszą linia statusu jak w Gomoku („Ania szuka pary…”), bez przycisku: dotknięcie karty to ruch,
   - `screens/Game.tsx`: gałąź `def.id === "memory"` i liczba par w pigułce gracza w trakcie partii (obok gałęzi `ludo`/`fleet`),
     nie trafia do `MINI_GAMES`; `screens/Lobby.tsx`: ikona `Cards` w `ICONS`, zdanie w `BLURBS`.
5. **Opis** w `KONCEPT.md`: podsekcja w rozdziale 2, limit miejsc w założeniach, tabela etapów.

## Weryfikacja

- `pnpm --filter @mini-games/games exec vitest run src/memory.test.ts` (po kroku 2 czerwone, po kroku 3 zielone),
  potem `pnpm typecheck && pnpm test`.
- `/dev?n=2` i `/dev?n=6` w przeglądarce (Playwright, 360×640), każdy tryb: pełna partia, pudło (1,5 s i szybki ruch rywala),
  seria par, remis, rewanż, odświeżenie z odkrytą pierwszą kartą, limit tury, wyjście gracza, obserwator,
  w wiadomościach WebSocket nie ma symboli zakrytych kart.
