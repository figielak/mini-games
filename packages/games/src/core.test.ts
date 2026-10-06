import { expect, test } from "vitest";
import { createRng, ROOM_CODE_ALPHABET, roomCode } from "./core.ts";

test("ten sam seed daje ten sam ciąg", () => {
  const a = createRng(42);
  const b = createRng(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test("rng zwraca liczby z [0, 1)", () => {
  const rng = createRng(1);
  for (let i = 0; i < 1000; i++) {
    const x = rng();
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  }
});

test("kod pokoju ma 4 znaki z alfabetu bez mylących znaków", () => {
  const rng = createRng(7);
  for (let i = 0; i < 200; i++) {
    const code = roomCode(rng);
    expect(code).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{4}$`));
  }
  expect(ROOM_CODE_ALPHABET).not.toMatch(/[O0I1L]/);
});
