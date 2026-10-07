import { DatabaseSync } from "node:sqlite";

const TOP = 10;

export interface RankingRow {
  nick: string;
  wins: number;
  played: number;
}

/** Wyniki partii po nicku, bez kont. Ranking per gra: najwięcej wygranych, przy remisie mniej partii. */
export function openStats(path: string) {
  const db = new DatabaseSync(path);
  // ponytail: dokładny nick ("Ala" i "ala" to dwa wiersze); nick siedzi w localStorage, więc z jednego telefonu jest stały
  db.exec("CREATE TABLE IF NOT EXISTS results (game_id TEXT NOT NULL, nick TEXT NOT NULL, won INTEGER NOT NULL, at INTEGER NOT NULL)");
  const insert = db.prepare("INSERT INTO results VALUES (?, ?, ?, ?)");
  const select = db.prepare(
    "SELECT game_id, nick, SUM(won) AS wins, COUNT(*) AS played FROM results GROUP BY game_id, nick ORDER BY wins DESC, played ASC, nick",
  );

  return {
    record(gameId: string, nicks: string[], winner: string) {
      const at = Date.now();
      db.exec("BEGIN");
      for (const nick of nicks) insert.run(gameId, nick, Number(nick === winner), at);
      db.exec("COMMIT");
    },

    ranking() {
      const byGame: Record<string, RankingRow[]> = {};
      for (const row of select.all() as { game_id: string; nick: string; wins: number; played: number }[]) {
        const rows = (byGame[row.game_id] ??= []);
        if (rows.length < TOP) rows.push({ nick: row.nick, wins: row.wins, played: row.played });
      }
      return byGame;
    },
  };
}
