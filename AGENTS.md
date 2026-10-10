# AGENTS.md

Instrukcje dla agentów AI (Claude Code, GitHub Copilot). Odpowiadaj po polsku.

Prywatna platforma gier multiplayer w przeglądarce (games.figielak.dev): monorepo pnpm, TypeScript,
serwer Colyseus (Node 24), frontend Vite + React, zasady gier jako czyste funkcje w `packages/games`.

## Najpierw przeczytaj

| Plik | Co zawiera | Kiedy czytać |
|---|---|---|
| `KONCEPT.md` | założenia, lista gier, architektura, kontrakt `GameDefinition`, reguły platformy, stack, struktura repo | zawsze, przed pierwszą zmianą |
| `ZASADY-GIER.md` | dokładne zasady każdej gry | przed zmianą gry (jej sekcja) |
| `ZASADY.md` | proces dodawania gry, obowiązkowe testy, spójność zasad, wyglądu, animacji i wibracji | przed nową grą albo zmianą ekranu gry |
| `README.md` | dev i deploy | przy pracy z infrastrukturą |

Te pliki są źródłem prawdy. Nie powielaj ich treści tutaj; po zmianie zasad lub architektury popraw właściwy plik.

## Komendy

```sh
pnpm install
pnpm --filter server dev   # http://localhost:2567, node --watch (restart po zmianie w apps/server i packages/games)
pnpm --filter web dev      # http://localhost:5173, tryb testowy: /dev?n=4
pnpm typecheck && pnpm test
pnpm --filter @mini-games/games exec vitest run src/<gra>.test.ts   # jeden plik testów
pnpm --filter web build
```

Przed zgłoszeniem zmiany jako gotowej: `pnpm typecheck && pnpm test` bez błędów (to samo sprawdza CI).

## Sposób pracy

- Plan → akceptacja użytkownika → implementacja.
- TDD: testy zasad gry (`packages/games/src/<gra>.test.ts`) w osobnym commicie **przed** implementacją.
  Nie zmieniaj testów pod implementację; jeśli zasada była zła, najpierw popraw test i `ZASADY-GIER.md`.
- Zmiana zasad gry = aktualizacja `ZASADY-GIER.md` (i `KONCEPT.md`, jeśli dotyczy opisu gry) w tym samym zadaniu.
- Commity po polsku, w formie „<Gra>: co się zmieniło”. Commit i push tylko na prośbę użytkownika.
- Push na `master` buduje i publikuje obraz produkcyjny, więc pracuj na gałęzi.

## Twarde reguły

- **Serwer jest jedynym źródłem prawdy.** Klient wysyła intencje, `validateMove` jest jedynym strażnikiem.
- **Losowość tylko z `rng`** przekazanego do `setup` i `applyMove`. Żadnego `Math.random` ani `Date.now` w zasadach.
- **Stan gry to zwykły obiekt JSON**, `applyMove` zwraca nowy i nie zmienia poprzedniego.
- **Ukryte informacje** filtruje `playerView`; obserwator dostaje widok dla `""`.
- **`apps/server` nie może mieć bezpośredniej zależności `zod`** (druga kopia `@colyseus/core` daje
  „seat reservation expired”). Schematy trzymamy w `packages/games`.
- **`id` gry nigdy się nie zmienia** (klucz rankingu w SQLite), nawet gdy zmienia się nazwa w UI.
- **Bez nowych zależności** bez zgody użytkownika; animacje w CSS (`index.css`), wspólne funkcje z `core.ts`.
- **UI**: tylko ciemny motyw, kolory z tokenów, teksty po polsku bez em-dashy, kolor gracza zamiast czerwieni
  dla jego akcji, pola dotykowe min. 48 px, ekran mieści się na 360×640. Szczegóły w `ZASADY.md` (sekcje 4 i 5).
