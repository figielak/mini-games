import { describe, expect, it } from "vitest";
import { openStats } from "./stats.ts";

describe("statystyki", () => {
  it("zwycięzca dostaje wygraną i partię, reszta tylko partię", () => {
    const stats = openStats(":memory:");
    stats.record("statki", ["Ala", "Ola"], "Ala");
    expect(stats.ranking()).toEqual({
      statki: [
        { nick: "Ala", wins: 1, played: 1 },
        { nick: "Ola", wins: 0, played: 1 },
      ],
    });
  });

  it("gry liczą się osobno", () => {
    const stats = openStats(":memory:");
    stats.record("statki", ["Ala", "Ola"], "Ala");
    stats.record("chinczyk", ["Ala", "Ola", "Ela"], "Ela");
    const ranking = stats.ranking();
    expect(ranking.statki).toHaveLength(2);
    expect(ranking.chinczyk[0]).toEqual({ nick: "Ela", wins: 1, played: 1 });
  });

  it("sortuje po wygranych, przy remisie wyżej ten z mniejszą liczbą partii", () => {
    const stats = openStats(":memory:");
    stats.record("statki", ["Ala", "Ola"], "Ala");
    stats.record("statki", ["Ala", "Ola"], "Ola");
    stats.record("statki", ["Ala", "Ola"], "Ola");
    stats.record("statki", ["Ela", "Ula"], "Ela");
    expect(stats.ranking().statki.map((r) => r.nick)).toEqual(["Ola", "Ela", "Ala", "Ula"]);
  });

  it("pokazuje najwyżej 10 nicków na grę", () => {
    const stats = openStats(":memory:");
    for (let i = 0; i < 12; i++) stats.record("statki", [`G${i}`, "X"], `G${i}`);
    expect(stats.ranking().statki).toHaveLength(10);
  });
});
