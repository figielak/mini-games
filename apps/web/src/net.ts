import { Client, type Room } from "@colyseus/sdk";
import type { RoomView } from "@mini-games/games";

// W dev serwer gry stoi obok Vite na porcie 2567 tego samego hosta (działa też z telefonu w LAN).
const client = new Client(import.meta.env.DEV ? `http://${location.hostname}:2567` : location.origin);

const TOKEN_KEY = "mg.token";
const NICK_KEY = "mg.nick";

// localStorage potrafi rzucić (tryb prywatny, zablokowane dane), a bez niego aplikacja dalej ma działać.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export const savedNick = () => read(NICK_KEY) ?? "";

// Serwer wysyła stan pokoju od razu po dołączeniu, zanim React podepnie nasłuch,
// więc nasłuch wisi tu od początku, a ostatni stan czeka na komponent.
const rooms = new WeakMap<Room, { view: RoomView | null; listener?: (v: RoomView) => void }>();

export function watchRoom(room: Room, listener: (v: RoomView) => void) {
  const entry = rooms.get(room)!;
  entry.listener = listener;
  if (entry.view) listener(entry.view);
  return () => (entry.listener = undefined);
}

function remember(room: Room, nick?: string) {
  const entry: { view: RoomView | null; listener?: (v: RoomView) => void } = { view: null };
  rooms.set(room, entry);
  room.onMessage("room", (v: RoomView) => {
    entry.view = v;
    entry.listener?.(v);
  });
  write(TOKEN_KEY, room.reconnectionToken);
  if (nick) write(NICK_KEY, nick);
  room.onReconnect(() => write(TOKEN_KEY, room.reconnectionToken));
  return room;
}

export const createRoom = async (nick: string) => remember(await client.create("lobby", { nick }), nick);

export const joinRoom = async (code: string, nick: string) =>
  remember(await client.joinById(code, { nick }), nick);

/** Wraca do pokoju sprzed odświeżenia strony. Jedna próba na załadowanie strony: token działa tylko raz. */
let resuming: Promise<Room | null> | undefined;
export const resumeRoom = () => (resuming ??= tryResume());

/** Kod z linku udostępnienia (`/?kod=ABCD`). */
export const codeFromUrl = () => new URLSearchParams(location.search).get("kod")?.toUpperCase() ?? "";

async function tryResume(): Promise<Room | null> {
  const token = read(TOKEN_KEY);
  if (!token) return null;
  // Token ma postać "KOD:sesja". Link do innego pokoju wygrywa z powrotem do starego.
  const linked = codeFromUrl();
  if (linked && linked !== token.split(":")[0]) return null;
  try {
    return remember(await client.reconnect(token));
  } catch {
    write(TOKEN_KEY, null);
    return null;
  }
}

export const forgetRoom = () => write(TOKEN_KEY, null);

export function errorText(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/not found|invalid/i.test(message)) return "Nie ma pokoju o tym kodzie.";
  if (/locked|full/i.test(message)) return "Ten pokój jest już pełny.";
  if (/failed to fetch|network/i.test(message)) return "Brak połączenia z serwerem.";
  return message;
}
