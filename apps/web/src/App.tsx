import { Client } from "@colyseus/sdk";
import { useEffect, useState } from "react";

const endpoint = import.meta.env.DEV ? "http://localhost:2567" : location.origin;

export function App() {
  const [status, setStatus] = useState("łączenie…");

  useEffect(() => {
    let left = false;
    const joining = new Client(endpoint).joinOrCreate("hello");
    joining
      .then((room) => {
        if (left) return void room.leave();
        room.onMessage("hello", ({ clients }: { clients: number }) =>
          setStatus(`połączono (graczy w pokoju: ${clients})`),
        );
        room.onLeave(() => setStatus("rozłączono"));
      })
      .catch((e) => setStatus(`błąd: ${e.message}`));
    return () => {
      left = true;
      joining.then((room) => room.leave(), () => {});
    };
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center p-4 text-xl">{status}</main>
  );
}
