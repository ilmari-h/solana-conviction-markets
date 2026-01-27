import { x25519 } from "@arcium-hq/client";
import {
  deriveX25519KeypairFromSignature,
  generateX25519Keypair,
} from "./keypairs";

describe("deriveX25519KeypairFromSignature", () => {
  test("derives a valid x25519 keypair from signature", () => {
    // Simulate a wallet signature
    const signature = new Uint8Array(64);
    crypto.getRandomValues(signature);

    const keypair = deriveX25519KeypairFromSignature(signature);

    // Verify keypair structure
    expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.secretKey.length).toBe(32);
    expect(keypair.publicKey.length).toBe(32);
  });

  test("is deterministic - same signature produces same keypair", () => {
    const signature = new Uint8Array(64);
    crypto.getRandomValues(signature);

    const keypair1 = deriveX25519KeypairFromSignature(signature);
    const keypair2 = deriveX25519KeypairFromSignature(signature);

    // Should produce identical keypairs
    expect(keypair1.secretKey).toEqual(keypair2.secretKey);
    expect(keypair1.publicKey).toEqual(keypair2.publicKey);
  });

  test("different signatures produce different keypairs", () => {
    const signature1 = new Uint8Array(64);
    const signature2 = new Uint8Array(64);
    crypto.getRandomValues(signature1);
    crypto.getRandomValues(signature2);

    const keypair1 = deriveX25519KeypairFromSignature(signature1);
    const keypair2 = deriveX25519KeypairFromSignature(signature2);

    // Should produce different keypairs
    expect(keypair1.secretKey).not.toEqual(keypair2.secretKey);
    expect(keypair1.publicKey).not.toEqual(keypair2.publicKey);
  });

  test("can perform x25519 shared secret derivation", () => {
    // Create two parties with derived keypairs
    const aliceSignature = new Uint8Array(64);
    const bobSignature = new Uint8Array(64);
    crypto.getRandomValues(aliceSignature);
    crypto.getRandomValues(bobSignature);

    const aliceKeypair = deriveX25519KeypairFromSignature(aliceSignature);
    const bobKeypair = deriveX25519KeypairFromSignature(bobSignature);

    // Alice derives shared secret with Bob's public key
    const aliceSharedSecret = x25519.getSharedSecret(
      aliceKeypair.secretKey,
      bobKeypair.publicKey
    );

    // Bob derives shared secret with Alice's public key
    const bobSharedSecret = x25519.getSharedSecret(
      bobKeypair.secretKey,
      aliceKeypair.publicKey
    );

    // Shared secrets should match (ECDH property)
    expect(aliceSharedSecret).toEqual(bobSharedSecret);
    expect(aliceSharedSecret.length).toBe(32);
  });

  test("works with Arcium MPC operations", () => {
    // Simulate deriving a keypair from a wallet signature
    const walletSignature = new Uint8Array(64);
    crypto.getRandomValues(walletSignature);

    const userKeypair = deriveX25519KeypairFromSignature(walletSignature);

    // Simulate MXE (MPC execution environment) keypair
    const mxeKeypair = generateX25519Keypair();

    // User can derive shared secret with MXE
    const userSharedSecret = x25519.getSharedSecret(
      userKeypair.secretKey,
      mxeKeypair.publicKey
    );

    // MXE can derive the same shared secret
    const mxeSharedSecret = x25519.getSharedSecret(
      mxeKeypair.secretKey,
      userKeypair.publicKey
    );

    // They should match - this is what enables encrypted communication
    expect(userSharedSecret).toEqual(mxeSharedSecret);
    expect(userSharedSecret.length).toBe(32);
  });

  test("handles edge cases - all zeros signature", () => {
    const signature = new Uint8Array(64); // All zeros

    const keypair = deriveX25519KeypairFromSignature(signature);

    // Should still produce valid keypair
    expect(keypair.secretKey.length).toBe(32);
    expect(keypair.publicKey.length).toBe(32);

    // Public key should be derivable from secret key
    const expectedPublicKey = x25519.getPublicKey(keypair.secretKey);
    expect(keypair.publicKey).toEqual(expectedPublicKey);
  });

  test("handles edge cases - all ones signature", () => {
    const signature = new Uint8Array(64).fill(0xff);

    const keypair = deriveX25519KeypairFromSignature(signature);

    // Should still produce valid keypair
    expect(keypair.secretKey.length).toBe(32);
    expect(keypair.publicKey.length).toBe(32);

    // Public key should be derivable from secret key
    const expectedPublicKey = x25519.getPublicKey(keypair.secretKey);
    expect(keypair.publicKey).toEqual(expectedPublicKey);
  });
});
