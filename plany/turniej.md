# Turniej z mini-gier + osobny ekran mini-gier

## Context

Mini-gry są dziś pojedynczymi partiami wybieranymi z długiej listy w lobby. Chcemy:
1. **Turniej**: seria mini-gier puszczana przez serwer po kolei, z punktami za miejsca i jednym zwycięzcą.
2. **Porządek w lobby**: lista gier głównych dostaje dwa kafle, „Turniej” i „Mini-gry”; siatka mini-gier
   przenosi się na osobny ekran (tak jak gry główne mają już `Setup.tsx`).

Ustalenia z użytkownikiem:
- dobór gier: gospodarz ustawia **liczbę gier**, a każdą mini-grę może oznaczyć jako **na pewno** albo **wykluczoną**; resztę losuje serwer,
- remis na szczycie: więcej wygranych gier, potem **jedna dogrywka** (dodatkowa wylosowana gra), po niej ewentualnie brak zwycięzcy,
- między grami: „Dalej” od wszystkich albo automatycznie po **15 s**.

Turniej to playlista w pokoju, nie nowa `GameDefinition`: każda gra leci zwykłym `startMatch`/`finish`
(instrukcja, limity, wyniki i ranking per gra bez zmian), pokój tylko sumuje punkty i odpala następną.

## Zasady turnieju (trafią do `ZASADY-GIER.md`)

- Gracze: wszyscy z miejscem (1-6), skład stały na cały turniej; kto dołączy w trakcie, ogląda.
- Konfiguracja `{ length, must, skip }`: `length` od 3 do liczby niewykluczonych mini-gier (domyślnie 8), `must` i `skip` rozłączne.
  Gdy `must` jest dłuższe niż `length`, długość rośnie do `must.length`. Zmiana konfiguracji kasuje gotowość gości.
- Losowanie na starcie: wszystkie `must` + losowe z reszty puli, bez powtórzeń, kolejność potasowana (`shuffle` z `core.ts`, `rng` serwera).
- Punkty za grę: **liczba graczy ze ściśle gorszym wynikiem** (4 graczy bez remisów: 3/2/1/0; remisujący dostają tyle samo).
  Gra przerwana (ktoś wyszedł, błąd) daje wszystkim 0 i turniej leci dalej.
- Tabela: suma punktów malejąco, potem liczba wygranych gier (wygrana = samodzielne 1. miejsce).
- Koniec: po ostatniej grze zwycięzcą jest samodzielny lider tabeli. Przy remisie (punkty i wygrane) serwer dolosowuje
  jedną grę dogrywki (spoza rozegranych i wykluczonych; gdy takich brak, dowolną niewykluczoną). Po dogrywce remis zostaje remisem.
- Wyjście gracza: bieżąca gra kończy się bez punktów, gracz znika z tabeli, turniej trwa, dopóki został ktokolwiek z miejscem.
- Ranking SQLite: pojedyncze gry zapisują się jak dziś, zwycięzca turnieju dodatkowo pod stałym id `turniej`.

## Zmiany

### A. Lobby: kafle „Turniej” i „Mini-gry”, osobny ekran mini-gier (bez logiki turnieju)
- `apps/web/src/screens/Lobby.tsx`: jedna sekcja z grami głównymi + dwa kafle na końcu; znika grupa „Szybkie i refleksowe” (`GROUPS`).
- Nowy `apps/web/src/screens/MiniGames.tsx`: górny wiersz jak w `Setup.tsx`, siatka mini-gier (gospodarz), karta „Wybrana gra” (gość),
  `Players`, `StartBar` (istniejące eksporty z `Lobby.tsx`).
- Górny wiersz („Gry”/„Wyjdź” + kod pokoju) wydzielić z `Setup.tsx` do `ui.tsx` jako `TopBar`; używają go `Setup`, `MiniGames` i ekran turnieju.
- `apps/web/src/App.tsx`: ekran mini-gier pokazuje się, gdy wybrana gra ma `minPlayers === 1` (u wszystkich) albo gdy gospodarz
  otworzył go lokalnie kaflem (`useState`); „Gry” zamyka go i wysyła `pickGame` z `null`. Bez nowego stanu na serwerze.

### B. Miejsca z remisami w kontrakcie (TDD)
`rankResults` gubi remisy poza pierwszym miejscem, a dopisanie pola do `GameResult` rozbiłoby ok. 100 asercji `toEqual` w testach gier.
- `packages/games/src/core.ts`: nowe `rankPlaces(players, results, compare)` → `Record<PlayerId, number>` (miejsca od 1, remis = to samo miejsce)
  i opcjonalne `places?(state)` w `GameDefinition`.
- 19 mini-gier: jedna linia `places` obok `isOver`, z tym samym komparatorem (wzór: `schulte.ts`, `stoper.ts`; `kolo.ts` liczy z `state.best`).
- Testy przed kodem: `core.test.ts` (`rankPlaces`) i `index.test.ts` (każda mini-gra po losowej partii ma `places` zgodne z `ranking`,
  a `winner` istnieje dokładnie wtedy, gdy miejsce 1 ma jedna osoba z 2+).

### C. Zasady turnieju jako czyste funkcje (TDD)
Nowe `packages/games/src/turniej.ts` + `turniej.test.ts`, eksport z `index.ts`:
- stałe `TOURNAMENT_ID = "turniej"`, `MIN_LENGTH = 3`, `DEFAULT_LENGTH = 8`, `NEXT_SECONDS = 15`,
- `cleanConfig(raw, pool)` → poprawiona konfiguracja albo `null`,
- `draw(config, pool, rng)` → lista id gier,
- `gamePoints(places, players)`, `advance(t, players, places | null, pool, rng)` (dopisuje punkty, przesuwa indeks, dolosowuje dogrywkę),
- `standings(t, players)` → `{ id, total, last, wins }[]`, `isDone(t)`, `winner(t, players)`.
Stan `Tournament = { config, games, index, points: Record<PlayerId, number>[], extra: boolean }` to zwykły JSON; `pool` (id mini-gier)
przychodzi z zewnątrz, żeby plik nie importował `index.ts`. Test rejestru: `GAMES["turniej"]` nie istnieje.

### D. Pokój
- `packages/games/src/lobby.ts`: wiadomość `pickTournament` (schemat konfiguracji), pole `tournament: Tournament | null` w `RoomView`.
- `apps/server/src/LobbyRoom.ts`:
  - `pickTournament` (gospodarz, faza `lobby`): `cleanConfig`, `gameId = null`, miejsca dla wszystkich, `resetReady()`; `pickGame` kasuje turniej,
  - `ready`, `toggleSeat`, `onJoin`, `start`: „wybrana gra **albo** turniej” (limit miejsc turnieju to `MAX_PLAYERS`, minimum 1),
  - `start` z turniejem: `draw`, `gameId = games[0]`, `startMatch`,
  - `finish`: w turnieju `advance` z `def.places(state)` (albo `null` przy przerwanej grze), bez `scores` za pojedyncze gry;
    jeśli nie koniec, `turnTimer` na `NEXT_SECONDS` (widoczny przez istniejące `msLeft`), jeśli koniec, `stats.record("turniej", ...)` i `scores` +1 dla zwycięzcy,
  - `rematch` w turnieju znaczy „Dalej” (wszyscy gotowi → następna gra), a po końcu turnieju nowe losowanie z tą samą konfiguracją,
  - `toLobby`: w trakcie turnieju tylko gospodarz („Zakończ turniej”); wraca na ekran turnieju z zachowaną konfiguracją,
  - `onLeave` w trakcie gry turniejowej: `finish({})` zamiast walkowera.

### E. Ekrany turnieju
- `apps/web/src/screens/Setup.tsx`: drugi komponent `TournamentSetup` na tym samym układzie: opis, „Liczba gier” (przyciski − i +, 48 px),
  siatka mini-gier z trzema stanami po dotknięciu (losowo → na pewno → bez → losowo), wiersz podsumowania („8 gier: 2 pewne, 6 losowych z 15”),
  `Players`, `StartBar`. Gość widzi to samo tylko do odczytu.
- `Players` i `StartBar` w `Lobby.tsx`: zamiast `def` biorą „wybór” (`{ name, minPlayers, maxPlayers }` z gry albo turnieju), jedna funkcja pomocnicza.
- `apps/web/src/screens/Game.tsx`:
  - nagłówek: etykieta „Turniej · gra 3/8” (dogrywka: „Dogrywka”), w pigułkach graczy suma punktów turnieju zamiast pucharów,
  - po grze: kafel tabeli turnieju (miejsce, nick, `+punkty` za tę grę, suma), „Następna: <gra> za N s” i przycisk „Dalej”;
    gospodarz ma dodatkowo „Zakończ turniej”,
  - po ostatniej grze: tytuł „Turniej wygrywa X” / „Remis”, tabela z wygranymi grami, istniejące `OverActions` (Rewanż, Do lobby).
- `apps/web/src/App.tsx`: `view.tournament` w fazie `lobby` → `TournamentSetup`.
- `apps/web/src/screens/Home.tsx`: ranking pokazuje też `turniej` (dziś filtruje po `GAMES[id]`).

### F. Dokumenty
`ZASADY-GIER.md` (nowa sekcja „Turniej”), `KONCEPT.md` (opis, reguły platformy, kontrakt z `places`, struktura repo), `ZASADY.md` (krok „mini-gra ma `places`”),
kopia planu w `plany/turniej.md`.

## Poza zakresem
- Gry główne w turnieju, drabinka 1v1, zapis turnieju po restarcie serwera.
- Opcje własne gier (`options`), podgląd planszy na ekranie gry.

## Kolejność commitów (na prośbę, nowa gałąź `turniej`)
1. „Lobby: kafle Turniej i Mini-gry, osobny ekran mini-gier” (A, kafel Turniej jeszcze nieaktywny)
2. „Turniej: ustalenia zasad i plan” (sekcja w `ZASADY-GIER.md`, `plany/turniej.md`)
3. „Mini-gry: testy miejsc z remisami” → 4. „Mini-gry: miejsca z remisami (rankPlaces, places)”
5. „Turniej: testy zasad” → 6. „Turniej: zasady (losowanie, punkty, tabela, dogrywka)”
7. „Turniej: pokój (start, punkty po grze, następna gra, koniec)”
8. „Turniej: ekran ustawień, tabela między grami i podsumowanie”
9. „Turniej: opis w KONCEPT”

## Weryfikacja
- `pnpm typecheck && pnpm test` po każdym kroku; testy z kroków 3 i 5 mają nie przechodzić w chwili commitu.
- Dev (`pnpm --filter server dev`, `pnpm --filter web dev`), 3 graczy w 360×640 przez Playwright:
  - lobby: kafle, ekran mini-gier u gospodarza i gościa, powrót „Gry”, pojedyncza mini-gra dalej startuje,
  - ekran turnieju: zmiana liczby gier i stanów kafli widoczna u gości, kasuje gotowość; granice (pewnych więcej niż długość, za mało gier w puli),
  - turniej na 3 gry: instrukcja i wyniki każdej gry, tabela i punkty po grze, „Dalej” od wszystkich oraz automat po 15 s,
    gra „na pewno” jest w puli, wykluczona nie; podsumowanie, rewanż z nowym losowaniem, „Do lobby” wraca na ekran turnieju,
  - wyjście gracza w trakcie gry: gra bez punktów, turniej trwa; „Zakończ turniej” tylko u gospodarza,
  - remis na szczycie wymuszony w teście jednostkowym `turniej.test.ts` (dogrywka), nie w przeglądarce.
