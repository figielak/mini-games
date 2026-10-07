import type { Room } from "@colyseus/sdk";
import type { RoomView } from "@mini-games/games";
import { CloseCode } from "@colyseus/sdk";
import { useEffect, useState } from "react";
import { forgetRoom, resumeRoom, watchRoom } from "./net.ts";
import { Home } from "./screens/Home.tsx";
import { Game } from "./screens/Game.tsx";
import { Lobby } from "./screens/Lobby.tsx";

export function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [resuming, setResuming] = useState(true);
  const [view, setView] = useState<RoomView | null>(null);
  const [dropped, setDropped] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    resumeRoom().then((r) => {
      setRoom(r);
      setResuming(false);
    });
  }, []);

  useEffect(() => {
    if (!room) return;
    const off = watchRoom(room, setView);
    room.onDrop(() => setDropped(true));
    room.onReconnect(() => setDropped(false));
    room.onLeave((code) => {
      forgetRoom();
      setRoom(null);
      setView(null);
      setDropped(false);
      if (code !== CloseCode.CONSENTED) setNotice("Połączenie z pokojem zostało zamknięte.");
    });
    return off;
  }, [room]);

  if (resuming) return <main className="min-h-[100dvh]" aria-busy />;
  if (!room) return <Home onRoom={setRoom} notice={notice} />;
  const send = (type: string, payload?: unknown) => room.send(type, payload);
  if (view && view.phase !== "lobby") return <Game view={view} me={room.sessionId} dropped={dropped} send={send} />;
  return <Lobby view={view} me={room.sessionId} dropped={dropped} send={send} onLeave={() => room.leave()} />;
}
