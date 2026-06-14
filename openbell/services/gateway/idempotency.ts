import * as Crypto from "expo-crypto";

export function makeIdempotencyKey(seed?: string): string {
  if (seed && typeof seed === "string" && seed.length > 0) return seed;
  return Crypto.randomUUID();
}
