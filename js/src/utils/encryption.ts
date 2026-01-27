import { x25519, RescueCipher, getMXEPublicKey } from "@arcium-hq/client";
import type { AnchorProvider } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import type { X25519Keypair } from "../types";

/**
 * Encryption context for working with encrypted data
 */
export interface EncryptionContext {
  /** Rescue cipher for encryption/decryption */
  cipher: RescueCipher;
  /** User's X25519 keypair */
  x25519Keypair: X25519Keypair;
}

/**
 * Fetches the MXE public key from the on-chain program
 *
 * @param provider - Anchor provider
 * @param programId - Program ID
 * @returns The MXE's X25519 public key
 */
export async function fetchMXEPublicKey(
  provider: AnchorProvider,
  programId: PublicKey
): Promise<Uint8Array> {
  const key = await getMXEPublicKey(provider, programId);
  if (!key) {
    throw new Error("Failed to fetch MXE public key");
  }
  return key;
}

/**
 * Creates an encryption context for a user
 *
 * Derives a shared secret with the MXE and creates a Rescue cipher
 * for encryption/decryption operations.
 *
 * @param x25519Keypair - User's X25519 keypair
 * @param mxePublicKey - MXE's public key (fetch with fetchMXEPublicKey)
 * @returns Encryption context with cipher
 */
export function createEncryptionContext(
  x25519Keypair: X25519Keypair,
  mxePublicKey: Uint8Array
): EncryptionContext {
  const sharedSecret = x25519.getSharedSecret(
    x25519Keypair.secretKey,
    mxePublicKey
  );
  const cipher = new RescueCipher(sharedSecret);

  return {
    cipher,
    x25519Keypair,
  };
}

/**
 * Encrypts values for buying market shares
 *
 * @param context - Encryption context
 * @param amount - Number of shares to buy
 * @param selectedOption - Option index (1-based)
 * @param nonce - 16-byte nonce for encryption
 * @returns Encrypted amount and option as Uint8Arrays
 */
export function encryptBuySharesInput(
  context: EncryptionContext,
  amount: bigint,
  selectedOption: bigint,
  nonce: Uint8Array
): {
  amountCiphertext: Uint8Array;
  selectedOptionCiphertext: Uint8Array;
} {
  const ciphertexts = context.cipher.encrypt([amount, selectedOption], nonce);

  if (!ciphertexts[0] || !ciphertexts[1]) {
    throw new Error("Encryption failed");
  }

  return {
    amountCiphertext: new Uint8Array(ciphertexts[0]),
    selectedOptionCiphertext: new Uint8Array(ciphertexts[1]),
  };
}
