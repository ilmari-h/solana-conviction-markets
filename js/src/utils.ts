import { randomBytes } from "crypto";

/**
 * Generates a random computation offset for Arcium computations.
 * Returns a BigInt from 8 random bytes.
 */
export function randomComputationOffset(): bigint {
  return BigInt("0x" + randomBytes(8).toString("hex"));
}
