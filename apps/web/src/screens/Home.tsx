import { ArrowRight, Plus } from "@phosphor-icons/react";
import { cleanNick, GAMES, NICK_MAX, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, TOURNAMENT_ID } from "@mini-games/games";
import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { codeFromUrl, createRoom, errorText, fetchRanking, joinRoom, type RankingRow, savedNick } from "../net.ts";

/** Wklejony link `/?kod=ABCD` daje sam kod, nie litery z adresu. */
const onlyCodeChars = (s: string) =>
  [...(s.match(/kod=(\w+)/i)?.[1] ?? s).toUpperCase()].filter((c) => ROOM_CODE_ALPHABET.includes(c)).join("").slice(0, ROOM_CODE_LENGTH);

export function Home({ onRoom, notice }: { onRoom: (room: Room) => void; notice?: string }) {
  const [nick, setNick] = useState(savedNick);
  const [code, setCode] = useState(() => onlyCodeChars(codeFromUrl()));
  const [nickError, setNickError] = useState("");
  const [roomError, setRoomError] = useState(notice ?? "");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [ranking, setRanking] = useState<Record<string, RankingRow[]>>({});

  useEffect(() => {
    fetchRanking().then(setRanking);
  }, []);

  async function go(action: "create" | "join") {
    const clean = cleanNick(nick);
    setNickError(clean ? "" : `Wpisz nick (do ${NICK_MAX} znaków).`);
    setRoomError("");
    if (!clean) return;
    setBusy(action);
    try {
      onRoom(action === "create" ? await createRoom(clean) : await joinRoom(code, clean));
      history.replaceState(null, "", "/");
    } catch (e) {
      setRoomError(errorText(e));
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-3 px-4 pt-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-6">
        <h1 className="text-4xl font-semibold tracking-tight">Gry</h1>
        <p className="mt-2 text-fg-muted">Wpisz nick i kod od znajomych albo załóż własny pokój.</p>
      </header>

      <section className="tile flex flex-col gap-2">
        <label htmlFor="nick" className="label">
          Nick
        </label>
        <input
          id="nick"
          className="field"
          value={nick}
          maxLength={NICK_MAX}
          autoComplete="nickname"
          enterKeyHint="next"
          aria-invalid={!!nickError}
          aria-describedby="nick-error"
          onChange={(e) => setNick(e.target.value)}
        />
        <p id="nick-error" role="alert" className="text-sm text-accent empty:hidden">
          {nickError}
        </p>
      </section>

      <form
        className="tile flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === ROOM_CODE_LENGTH) go("join");
        }}
      >
        <label htmlFor="code" className="label">
          Kod pokoju
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            className="field font-mono text-xl tracking-[0.4em] uppercase"
            value={code}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={!!roomError}
            aria-describedby="room-error"
            onChange={(e) => setCode(onlyCodeChars(e.target.value))}
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={!!busy || code.length !== ROOM_CODE_LENGTH}>
            {busy === "join" ? "Łączenie…" : "Dołącz"}
            {busy !== "join" && <ArrowRight size={18} weight="bold" aria-hidden />}
          </button>
        </div>
        <p id="room-error" role="alert" className="text-sm text-accent empty:hidden">
          {roomError}
        </p>
      </form>

      <button type="button" className="btn btn-ghost w-full" disabled={!!busy} onClick={() => go("create")}>
        {busy === "create" ? (
          "Tworzenie pokoju…"
        ) : (
          <>
            <Plus size={18} weight="bold" aria-hidden />
            Utwórz pokój
          </>
        )}
      </button>

      <Ranking ranking={ranking} me={cleanNick(nick)} />
    </main>
  );
}

function Ranking({ ranking, me }: { ranking: Record<string, RankingRow[]>; me: string | null }) {
  // Turniej nie jest grą z rejestru, ale ma własny ranking.
  const title = (id: string) => (id === TOURNAMENT_ID ? "Turniej" : GAMES[id]?.name);
  const games = Object.entries(ranking).filter(([id]) => title(id));
  if (games.length === 0) return null;
  return (
    <section className="tile mt-3 flex flex-col gap-4" aria-labelledby="ranking">
      <h2 id="ranking" className="label">
        Ranking
      </h2>
      {games.map(([id, rows]) => (
        <div key={id}>
          <h3 className="mb-1 font-semibold">{title(id)}</h3>
          <ol className="flex flex-col text-sm">
            {rows.map((r, i) => (
              <li key={r.nick} className={`flex gap-3 py-0.5 ${r.nick === me ? "text-accent" : ""}`}>
                <span className="w-5 font-mono text-fg-subtle">{i + 1}</span>
                <span className="flex-1 truncate">{r.nick}</span>
                <span className="font-mono tabular-nums" aria-label={`${r.wins} wygranych z ${r.played} partii`}>
                  {r.wins}/{r.played}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
