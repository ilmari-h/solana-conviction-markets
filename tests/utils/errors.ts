import { expect } from "chai";
import { OnChainError } from "./transaction";

/**
 * Asserts that an async function throws an OnChainError with the expected code.
 *
 * @param fn - Async function expected to throw
 * @param expectedCode - Expected error code (hex constant from generated errors, e.g. 0x178a)
 */
export async function shouldThrowCustomError(
  fn: () => Promise<unknown>,
  expectedCode: number
): Promise<void> {
  try {
    await fn();
    expect.fail("Expected function to throw OnChainError");
  } catch (e) {
    expect(e).to.be.instanceOf(OnChainError);
    expect((e as OnChainError).code).to.equal(expectedCode);
  }
}
