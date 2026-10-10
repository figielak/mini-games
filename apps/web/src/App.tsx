import type { Room } from "@colyseus/sdk";
import { GAMES, type RoomView } from "@mini-games/games";
import { CloseCode } from "@colyseus/sdk";
import { useEffect, useState } from "react";
import { forgetRoom, resumeRoom, watchRoom } from "./net.ts";
import { Home } from "./screens/Home.tsx";
import { Game } from "./screens/Game.tsx";
import { Lobby } from "./screens/Lobby.tsx";
import { MiniGames } from "./screens/MiniGames.tsx";
import { Setup } from "./screens/Setup.tsx";

export function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [resuming, setResuming] = useState(true);
  const [view, setView] = useState<RoomView | null>(null);
  const [dropped, setDropped] = useState(false);
  const [notice, setNotice] = useState<string>();
  // Gospodarz otworzył listę mini-gier; samo otwarcie nie zmienia nic w pokoju.
  const [mini, setMini] = useState(false);

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
  const me = room.sessionId;
  const screen = { me, dropped, send, onLeave: () => room.leave() };
  const def = view?.gameId ? GAMES[view.gameId] : undefined;
  // Gra główna ma własny ekran przed partią; mini-gry wybiera się na osobnej liście.
  if (view && def && def.minPlayers > 1) return <Setup view={view} {...screen} />;
  if (view && (def || (mini && view.hostId === me))) {
    const back = () => {
      setMini(false);
      send("pickGame", { gameId: null });
    };
    return <MiniGames view={view} {...screen} onBack={back} />;
  }
  return <Lobby view={view} {...screen} onMini={() => setMini(true)} onTournament={() => {}} />;
}
