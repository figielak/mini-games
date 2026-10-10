import { useEffect, useState } from "react";

// Token pierwszej ramki ma postać "KOD:sesja", więc z niego reszta bierze kod pokoju.
const roomCode = () => localStorage.getItem("mg.token1")?.split(":")[0] ?? "";

/** Tryb testowy (tylko `pnpm dev`): kilka telefonów obok siebie w jednym pokoju. `/dev?n=4` zmienia liczbę graczy. */
export function Dev() {
  const players = Number(new URLSearchParams(location.search).get("n")) || 2;
  const [code, setCode] = useState(roomCode);

  useEffect(() => {
    const onStorage = () => setCode(roomCode());
    addEventListener("storage", onStorage);
    return () => removeEventListener("storage", onStorage);
  }, []);

  return (
    <main className="flex flex-wrap gap-4 p-4">
      {Array.from({ length: players }, (_, i) =>
        i === 0 || code ? (
          <iframe
            key={i}
            title={`Gracz ${i + 1}`}
            src={i === 0 ? "/?dev=1" : `/?dev=${i + 1}&kod=${code}`}
            className="h-[780px] w-[390px] rounded-2xl border border-white/15"
          />
        ) : null,
      )}
    </main>
  );
}
