import { ArrowRight, Plus } from "@phosphor-icons/react";
import { cleanNick, NICK_MAX, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@mini-games/games";
import { useState } from "react";
import type { Room } from "@colyseus/sdk";
import { codeFromUrl, createRoom, errorText, joinRoom, savedNick } from "../net.ts";

const onlyCodeChars = (s: string) =>
  [...s.toUpperCase()].filter((c) => ROOM_CODE_ALPHABET.includes(c)).join("").slice(0, ROOM_CODE_LENGTH);

export function Home({ onRoom, notice }: { onRoom: (room: Room) => void; notice?: string }) {
  const [nick, setNick] = useState(savedNick);
  const [code, setCode] = useState(() => onlyCodeChars(codeFromUrl()));
  const [nickError, setNickError] = useState("");
  const [roomError, setRoomError] = useState(notice ?? "");
  const [busy, setBusy] = useState(false);

  async function go(action: "create" | "join") {
    const clean = cleanNick(nick);
    setNickError(clean ? "" : `Wpisz nick (do ${NICK_MAX} znaków).`);
    setRoomError("");
    if (!clean) return;
    setBusy(true);
    try {
      onRoom(action === "create" ? await createRoom(clean) : await joinRoom(code, clean));
      history.replaceState(null, "", "/");
    } catch (e) {
      setRoomError(errorText(e));
      setBusy(false);
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
          <button type="submit" className="btn btn-primary shrink-0" disabled={busy || code.length !== ROOM_CODE_LENGTH}>
            Dołącz
            <ArrowRight size={18} weight="bold" aria-hidden />
          </button>
        </div>
        <p id="room-error" role="alert" className="text-sm text-accent empty:hidden">
          {roomError}
        </p>
      </form>

      <div className="mt-auto pt-6">
        <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => go("create")}>
          <Plus size={18} weight="bold" aria-hidden />
          Utwórz pokój
        </button>
      </div>
    </main>
  );
}
