# Ekran gry przed partią (ustawienia gier głównych)

## Context

Dziś tryby rozwijają się w lobby pod kaflem wybranej gry. Docelowo gry główne mają dostać własne
opcje (power-upy, bezpieczne pola, własne ustawienia), a lista przełączników nie zmieści się pod kaflem.
Ten plan robi pierwszy krok: **osobny ekran gry przed partią**, na razie z dzisiejszymi trybami.
Opcje własne (`options`, „Własny”) to osobne zadanie, gdy będzie znany pierwszy dodatek.

Ustalenia z użytkownikiem:
- ekran dostają **wszystkie gry główne** (`minPlayers > 1`): Gomoku, Statki, Chińczyk, Kampus Tour, Memory, Państwa-miasta,
- **mini-gry** (`minPlayers === 1`) startują z listy jak dziś i mają zasady narzucone z góry, bez trybów,
- w Tabeli Schultego znika tryb Łatwa, zostaje Klasyczna jako jedyna zasada.

## Przepływ

| Kto | Brak gry | Wybrana mini-gra | Wybrana gra główna |
|---|---|---|---|
| Gospodarz | lobby z listą gier | lobby, kafel podświetlony, „Zagraj” w pasku (jak dziś) | **ekran gry** |
| Gość | lobby, „Czekamy, aż X wybierze grę” | lobby z kartą „Wybrana gra” (jak dziś) | **ekran gry** tylko do odczytu |

Ekran jest funkcją stanu pokoju (`view.gameId`), bez nowej fazy na serwerze. Po partii „Do lobby” wraca
na ekran tej samej gry (gameId zostaje), więc można zmienić tryb i zagrać znowu.

Układ ekranu gry (jedna kolumna, przewija się, pasek akcji przyklejony):
1. Górny wiersz: gospodarz ma „Gry” (strzałka wstecz, `pickGame` z `null`), gość „Wyjdź”; po prawej kod pokoju (dotknięcie kopiuje link).
2. Kafel gry: ikona, nazwa, liczba graczy, opis z `BLURBS`.
3. „Tryb” (tylko gdy gra ma `modes`): ta sama lista radio co dziś; u gościa nieaktywna, wybrany tryb podświetlony.
4. Gracze: ta sama sekcja co w lobby (miejsca, gotowość, wybór koloru).
5. `StickyBar`: „Zagraj” / „Zgłaszam gotowość” / „Oglądasz”, bez zmian w logice.

## Zmiany

### 1. Schulte bez trybów (TDD, osobno przed resztą)
- `packages/games/src/schulte.test.ts`: usunąć testy trybów (linie ok. 83-91) i punkt z nagłówka; dodać test „gra nie ma trybów”.
- `packages/games/src/index.test.ts`: test kontraktu „mini-gry nie mają trybów” (`minPlayers === 1` ⇒ brak `modes`), pilnuje reguły na przyszłość.
- `packages/games/src/schulte.ts`: usunąć `MODES`, `modes`, pole `mode` ze `State` i z `setup`.
- `apps/web/src/games/Schulte.tsx:142`: usunąć gałąź `view.mode === "latwa"`.
- `ZASADY-GIER.md:78`, `KONCEPT.md:88`: usunąć opis trybów.

### 2. Powrót do listy gier
- `packages/games/src/lobby.ts`: `pickGame: z.object({ gameId: z.string().nullable() })`.
- `apps/server/src/LobbyRoom.ts` (handler `pickGame`, linia 69): dla `null` (gospodarz, faza `lobby`) ustawić
  `gameId = null`, `mode = null`, `seats = []`, `resetReady()`.
- `packages/games/src/index.test.ts`: jedna asercja, że schemat przyjmuje `null` i tekst, a odrzuca liczbę.

### 3. Ekran gry
- Nowy `apps/web/src/screens/Setup.tsx` z komponentem `Setup` (układ jak wyżej).
- `apps/web/src/screens/Lobby.tsx`:
  - wydzielić i wyeksportować to, co wspólne: sekcję graczy (linie 71-154) jako `Players`, dolny pasek (238-261) jako `StartBar`,
    oraz `ICONS`, `BLURBS`, `seats` (zostają w tym pliku, `ZASADY.md` na nie wskazuje),
  - na górze `Lobby`: gdy wybrana gra ma `minPlayers > 1`, zwrócić `<Setup />`,
  - z siatki gier usunąć rozwijane tryby (187-209), `Fragment` i `grid-flow-dense`; z karty gościa blok trybu (229-234).
- Bez nowych zależności, klasy z `index.css` (`.tile`, `.label`, `.btn`), ikony Phosphor, pola dotykowe min. 48 px.

### 4. Dokumenty
- `KONCEPT.md`: punkt „Lobby” w regułach platformy (ekran gry dla gier głównych, mini-gry bez trybów), `Setup.tsx` w strukturze repo.
- `ZASADY.md` (sekcja 1, „Tryby”): tryby tylko w grach głównych.
- Kopia planu w `plany/ekran-gry.md` (jak przy poprzednich zadaniach).

## Poza zakresem
- Opcje własne, presety jako zestawy opcji, `rules` w stanie gry, `pickOptions`.
- Podgląd planszy na ekranie gry (dodać razem z opcjami, gdy będzie co pokazywać).
- Turniej.

## Kolejność commitów (na prośbę, na nowej gałęzi, nie na `obrot`)
1. „Schulte: testy bez trybów” 2. „Schulte: jedna zasada, bez trybu Łatwa” 3. „Lobby: powrót do listy gier”
4. „Lobby: ekran gry dla gier głównych” 5. „Lobby: opis ekranu gry w dokumentach”

## Weryfikacja
- `pnpm typecheck && pnpm test`.
- `pnpm --filter server dev` + `pnpm --filter web dev`, `/dev?n=2`, viewport 360×640 (Playwright):
  - gospodarz wybiera Statki → obaj widzą ekran gry; zmiana trybu kasuje gotowość gościa; gość nie może zmienić trybu,
  - „Gry” wraca do listy u obu; wybór Gomoku pokazuje ekran bez sekcji „Tryb”,
  - mini-gra (Schulte) startuje z listy bez wyboru trybu, znalezione liczby zostają widoczne,
  - partia → „Do lobby” → ekran tej samej gry; przełączanie miejsc, kolor i „Wyjdź” działają na ekranie gry.
