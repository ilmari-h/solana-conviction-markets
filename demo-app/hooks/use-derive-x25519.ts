"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { deriveX25519KeypairFromSignature } from "@bench.games/conviction-markets";
import type { X25519Keypair } from "@bench.games/conviction-markets";

const STORAGE_KEY_PREFIX = "x25519_keypair_";
const SIGN_MESSAGE = "Sign this message to generate an encryption keypair for secure voting";

/**
 * Hook to derive and manage X25519 keypair from wallet signature
 *
 * Automatically derives a deterministic encryption keypair from the user's wallet signature
 * and stores it in browser localStorage. The keypair is required for encrypted operations.
 */
export function useDeriveX25519() {
  const { publicKey, signMessage } = useWallet();
  const [keypair, setKeypair] = useState<X25519Keypair | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setKeypair(null);
      setError(null);
      return;
    }

    // Check localStorage for existing keypair
    const storageKey = `${STORAGE_KEY_PREFIX}${publicKey.toBase58()}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const recoveredKeypair: X25519Keypair = {
          publicKey: new Uint8Array(parsed.publicKey),
          secretKey: new Uint8Array(parsed.secretKey),
        };
        setKeypair(recoveredKeypair);
        return;
      } catch (err) {
        console.error("Failed to parse stored keypair:", err);
        localStorage.removeItem(storageKey);
      }
    }

    // No keypair found, need to derive from signature
    const deriveKeypair = async () => {
      if (!signMessage) {
        setError("Wallet does not support message signing");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const message = new TextEncoder().encode(SIGN_MESSAGE);
        const signature = await signMessage(message);

        const derivedKeypair = deriveX25519KeypairFromSignature(signature);

        // Store in localStorage
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            publicKey: Array.from(derivedKeypair.publicKey),
            secretKey: Array.from(derivedKeypair.secretKey),
          })
        );

        setKeypair(derivedKeypair);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to sign message";
        setError(errorMessage);
        console.error("Error deriving X25519 keypair:", err);
      } finally {
        setLoading(false);
      }
    };

    deriveKeypair();
  }, [publicKey, signMessage]);

  return {
    keypair,
    loading,
    error,
    isReady: !loading && !!keypair,
  };
}
