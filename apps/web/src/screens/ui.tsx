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
