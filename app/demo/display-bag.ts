export type DisplayBag = { version: 2; codes: string[]; revision: number };
const valid = (code: unknown): code is string =>
  typeof code === "string" && /^LO-\d+[A-Za-z0-9-]*$/.test(code);
export function parseDisplayBag(value: unknown): DisplayBag | null {
  if (!value || typeof value !== "object") return null;
  const b = value as DisplayBag;
  if (
    b.version !== 2 ||
    !Array.isArray(b.codes) ||
    !b.codes.every(valid) ||
    !Number.isSafeInteger(b.revision) ||
    b.revision < 0
  )
    return null;
  return { version: 2, codes: [...new Set(b.codes)], revision: b.revision };
}
export function migrateDisplayBag(value: unknown): DisplayBag | null {
  if (!value || typeof value !== "object") return null;
  const w = value as {
    version: number;
    cards: Record<string, { draw: number; exchange: number }>;
  };
  if (
    w.version !== 1 ||
    !w.cards ||
    Array.isArray(w.cards) ||
    typeof w.cards !== "object"
  )
    return null;
  const codes: string[] = [];
  for (const [code, b] of Object.entries(w.cards)) {
    if (
      !valid(code) ||
      !b ||
      ![b.draw, b.exchange].every(
        (n) => Number.isSafeInteger(n) && n >= 0 && n <= 9999,
      )
    )
      return null;
    if (b.draw + b.exchange > 0) codes.push(code);
  }
  return { version: 2, codes, revision: 0 };
}
