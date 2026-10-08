# games.figielak.dev — koncept

Prywatna platforma z grami multiplayer w przeglądarce, do grania ze znajomymi na wykładach.
Jedna strona, kod pokoju, każdy gra na swoim telefonie.

## 1. Założenia

- **Do 6 graczy naraz** w pokoju, kilka pokoi równolegle.
- **Mobile-first**: telefon w pionie, bez instalacji (PWA z ikoną na ekranie głównym).
- **Bez kont**: gracz wpisuje nick i kod pokoju. Token sesji w `localStorage` pozwala wrócić do gry po odświeżeniu strony.
- **Dostęp**: strona publiczna, ale do gry trzeba znać kod pokoju. Brak publicznej listy pokoi.
- **Odporność na słabe Wi-Fi**: automatyczne ponowne łączenie, stan gry zawsze po stronie serwera.
- **Tryb wykładowy**: domyślnie bez dźwięku, ciemny motyw, wibracje zamiast powiadomień, limit czasu na turę.

## 2. Gry

### 2.1 Kampus Tour (klon Business Tour)

Główna gra platformy. Zachowuje rdzeń mechaniki oryginału, ale ma własny motyw i dodatki.
Mechanik można się inspirować, natomiast nazwy, grafiki i logo oryginału nie są kopiowane.

**Motyw:** Politechnika Rzeszowska i Rzeszów. Pola to budynki kampusu, wydziały i znane miejsca w mieście
(np. Rynek, Zamek Lubomirskich, Bulwary nad Wisłokiem, Millenium Hall). Ostateczna lista pól do ustalenia.

**Rdzeń (jak w oryginale):**
- pozioma plansza 32 pól (prostokąt 12×6, rogi: Początek, Kolokwium, Juwenalia, Bilet MPK), rzut dwiema kośćmi, dublet daje dodatkowy rzut,
- kupowanie pól i płacenie czynszu,
- grupy kolorów (np. kierunki studiów); posiadanie całej grupy zwiększa czynsz,
- rozbudowa pól aż do landmarku,
- **wykupienie pola** od innego gracza za 2× wartość (cena + budynki) po zapłaceniu czynszu (landmarku nie da się wykupić),
- zwycięstwo przez bankructwo przeciwników albo przez monopol (np. 3 pełne grupy kolorów).

**Własne dodatki (propozycje):**
| Oryginał | Kampus Tour |
|---|---|
| Start | **Początek**: premia za przejście |
| Więzienie | **Kolokwium**: tracisz turę albo zdajesz rzutem dubletu |
| Mistrzostwa świata | **Juwenalia**: wybrane własne pole ma czynsz ×2, kolejne Juwenalia ×3, ×4… (jedno pole naraz) |
| Podróż | **Bilet MPK**: przeskok na dowolne pole w następnej turze |
| Karty szansy | **Karty Dziekanatu**: stypendium, warunek, poprawka itp. |

**Długość partii:** maksymalnie około 45 minut. Po limicie rund (np. 20) albo czasu wygrywa
gracz z największym majątkiem (gotówka + wartość pól i budynków).

### 2.2 Poprawka (gra karciana typu Uno)

- 2–6 graczy, własne karty, nazwy i grafiki.
- Ukryte informacje: każdy widzi tylko swoją rękę (filtrowanie stanu per gracz).

### 2.3 Statki i Pięć w rzędzie

- Proste gry 1v1, zbudowane jako pierwsze, żeby przetestować cały przepływ platformy.
- Statki również wymagają ukrywania stanu (plansza przeciwnika).

### 2.4 Mini-gry (przerywniki)

- **Refleks**: dotknij pola, gdy zmieni kolor; 30 s, wynik = liczba trafień (remis: niższa średnia reakcja), falstart kosztuje czas.
- **Simon**: powtarzanie rosnącej sekwencji 4 kolorów, wynik = najdłuższa seria.
- 1-6 graczy naraz, każdy gra u siebie to samo wyzwanie (wylosowane na serwerze), na końcu ranking.
  Partia toczy się na kliencie (opóźnienie Wi-Fi zepsułoby pomiar), serwer dostaje tylko wynik i odrzuca nierealne wartości.

## 3. Architektura

```
Telefon (PWA, React)  ⇄  WebSocket  ⇄  Serwer Colyseus (Node)
                                          │
                                          ├─ logika gier (czyste funkcje TS)
                                          └─ SQLite (zapis stanu pokoi)
```

**Zasada:** serwer jest jedynym źródłem prawdy. Klient wysyła intencje („rzucam kośćmi”),
serwer je waliduje, losuje, liczy nowy stan i rozsyła każdemu graczowi jego widok.

### Interfejs gry

Każda gra to moduł niezależny od sieci i UI:

```ts
interface GameDefinition<State, Move> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  setup(players: PlayerId[], rng: Rng): State;
  validateMove(state: State, player: PlayerId, move: Move): boolean;
  applyMove(state: State, player: PlayerId, move: Move, rng: Rng): State;
  playerView(state: State, player: PlayerId): unknown; // ukrywanie informacji
  isOver(state: State): { winner?: PlayerId; ranking?: PlayerId[] } | null;
}
```

**Platforma (skorupa)** jest wspólna dla wszystkich gier: pokoje z 4-znakowym kodem
(bez mylących znaków typu O/0, I/1), lobby z wyborem gry, nicki i kolory graczy,
reconnect, tablica wyników, rewanż, sprzątanie pokoi po godzinie bezczynności.

**Synchronizacja:** stan gry to zwykły obiekt TS. Po każdym ruchu serwer wysyła wiadomość
z `playerView` osobno do każdego gracza, zamiast pełnej synchronizacji Schema z Colyseus.
Prościej i bezpiecznie dla gier z ukrytymi informacjami.

## 4. Stack

| Warstwa | Technologia |
|---|---|
| Język | TypeScript (wszędzie) |
| Monorepo | pnpm workspaces |
| Serwer / pokoje | Colyseus (Node.js) |
| Walidacja wiadomości | zod |
| Frontend | Vite + React |
| Style / animacje | Tailwind, Motion |
| Plansza | SVG / CSS Grid |
| PWA | manifest + ikony, bez service workera (gra i tak wymaga serwera) |
| Trwałość stanu | SQLite (wbudowany `node:sqlite`) |
| Testy | Vitest (szczególnie zasady Kampus Tour) |
| CI/CD | GitHub Actions → obraz Dockera |

## 5. Struktura repozytorium

```
games/
├─ packages/
│  ├─ core/        # typy, interfejs GameDefinition, RNG, utilsy
│  └─ games/       # kampus-tycoon/, poprawka/, statki/, piec-w-rzedzie/
├─ apps/
│  ├─ server/      # Colyseus, pokoje, SQLite, Dockerfile
│  └─ web/         # React PWA
├─ docker-compose.yml
└─ KONCEPT.md
```

## 6. Hosting

- **Raspberry Pi** w homelabie, kontener Docker obok istniejących usług.
- **Cloudflare Tunnel** (`cloudflared`) wystawia `games.figielak.dev` bez otwierania portów; obsługuje WebSockety.
- Jeden kontener serwuje zbudowany frontend i WebSockety.
- `mem_limit: 256m` w docker-compose, żeby gry nie zagroziły innym usługom.
  Spodziewane zużycie: ~100–150 MB RAM przy kilku pokojach.
- SQLite w wolumenie Dockera, objęty istniejącym backupem homelaba.
- Plan B: ten sam obraz na Cloud Run (`max-instances=1`, timeout 60 min, SQLite → Firestore).

## 7. Bezpieczeństwo i fair play

- Rzuty kośćmi i tasowanie kart tylko na serwerze.
- Walidacja każdego ruchu (czy to tura gracza, czy ruch jest dozwolony, czy stać go na zakup).
- Rate limiting wiadomości i limit liczby pokoi na IP.
- Brak danych osobowych: tylko nick i losowy token sesji.

## 8. Plan prac

| Etap | Zakres | Cel |
|---|---|---|
| 0 | Monorepo, Docker, tunnel, „hello world” pod subdomeną | Infrastruktura działa |
| 1 | Skorupa: pokoje, kody, lobby, nicki, reconnect | Platforma |
| 2 | Pięć w rzędzie | Pierwsza gra end-to-end, rewanż |
| 3 | Statki | Ukrywanie stanu (`playerView`) |
| 4 | Kampus Tour: rdzeń (ruch, kupno, czynsz, budowanie, bankructwo) | Grywalna wersja główna (gotowe) |
| 5 | Kampus Tour: dodatki (Kolokwium, Juwenalia, karty, wykupienie, Bilet MPK, monopol) | Pełna wersja (gotowe) |
| 6 | Poprawka | Gra karciana |
| 7 | PWA, animacje, statystyki, szlify | Polerka (PWA i ranking po nicku gotowe) |

## 9. Otwarte kwestie

- Nazwy pól Kampus Tour ustalone (grupy jako pory dnia studenta, Ksero i Stołówka jak wodociągi); druga nazwa w grupie „Rano” robocza (Automat z przekąskami).
- Balans ekonomii: start 200 zł (+20 zł za każde dalsze miejsce), kieszonkowe 40 zł, czynsz P/10 (cała grupa x2), z budynkami 0,4P / P / 2P / 4P; bez kompletu grupy do poziomu 2 (poziom 3 i landmark z kompletem), jazda Biletem MPK bez kieszonkowego. Zmiany po 4 partiach testowych (2026-10-07): poziom 3 od pierwszej tury i czynsze 60-100 zł przy pustych kieszeniach dawały szybkie bankructwa, a MPK zamieniał się w darmowy komplet. Do sprawdzenia w kolejnych partiach; jeśli monopol dalej będzie łatwy przez grupy dwupolowe, liczyć tylko grupy trzypolowe.
- Zestaw kart specjalnych w Poprawce (talia 18 Kart Dziekanatu ustalona, w kodzie: CARDS w kampus-tour.ts).
- Własna nazwa całej platformy.