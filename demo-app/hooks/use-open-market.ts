"use client";

import { useMutation } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { openMarket } from "@bench.games/conviction-markets";
import type { PublicKey } from "@solana/web3.js";

interface OpenMarketParams {
  /** Market PDA address */
  market: PublicKey;
  /** Unix timestamp when market opens for trading (defaults to now) */
  openTimestamp?: number;
}

interface OpenMarketResult {
  /** Signature of the transaction */
  signature: string;
}

/**
 * Hook to open an opportunity market for staking
 *
 * This hook handles the transaction to open a market:
 * 1. Builds the open market transaction with the specified timestamp
 * 2. Sends and confirms the transaction
 *
 * The market must be funded before it can be opened.
 *
 * @returns Tanstack Query mutation with openMarket function
 */
export function useOpenMarket() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const mutation = useMutation({
    mutationFn: async (params: OpenMarketParams): Promise<OpenMarketResult> => {
      if (!wallet.publicKey || !wallet.sendTransaction) {
        throw new Error("Wallet not connected");
      }

      // Default to current timestamp if not provided
      const openTimestamp = params.openTimestamp ?? (Math.floor(Date.now() / 1000) + 10);

      // STEP 1: Build the transaction
      console.log("Building open market transaction...");
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: "confirmed" }
      );

      const { transaction } = await openMarket(provider, {
        creator: wallet.publicKey,
        market: params.market,
        openTimestamp,
      });

      // STEP 2: Send and confirm the transaction
      const signature = await wallet.sendTransaction(transaction, connection);
      console.log("Open market transaction sent:", signature);

      await connection.confirmTransaction(signature, "confirmed");
      console.log("Market opened successfully");

      return { signature };
    },
  });

  return {
    openMarket: mutation.mutate,
    openMarketAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
