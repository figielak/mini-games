import { WifiSlash } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export type Send = (type: string, payload?: unknown) => void;

/** Wspólny układ ekranu: jedna kolumna, akcje przy dolnej krawędzi (strefa kciuka). */
export function Screen({ dropped, children }: { dropped: boolean; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-3 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {dropped && (
        <p role="status" className="flex items-center gap-2 rounded-inset bg-accent-soft px-4 py-3 text-sm">
          <WifiSlash size={18} aria-hidden />
          Łączenie ponownie…
        </p>
      )}
      {children}
    </main>
  );
}

/** Wyniki mini-gry: wiersz na gracza, w kolejności rankingu po końcu partii. */
export function Scores({ rows }: { rows: { id: string; nick: string; color?: string; me: boolean; score: string | null }[] }) {
  return (
    <ol className="tile flex flex-col gap-1 p-4">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
          <span className="flex-1">
            {r.nick}
            {r.me && <span className="text-fg-muted"> (ty)</span>}
          </span>
          <span className={`font-mono ${r.score === null ? "text-fg-muted" : ""}`}>{r.score ?? "gra…"}</span>
        </li>
      ))}
    </ol>
  );
}

/** Przycisk przyklejony do dołu ekranu: przy otwartej klawiaturze i długiej liście zostaje pod kciukiem. */
export function StickyBar({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 -mx-4 flex items-center gap-3 bg-bg/90 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">{children}</div>;
}
