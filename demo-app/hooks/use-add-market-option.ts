"use client";

import { useMutation } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { addMarketOption } from "@bench.games/conviction-markets";
import { insertOption } from "@/app/actions/markets";
import type { PublicKey } from "@solana/web3.js";

interface AddMarketOptionParams {
  /** Market PDA address */
  market: PublicKey;
  /** Option index (1-based, must be sequential) */
  optionIndex: number;
  /** Human-readable name for the option (max 50 characters) */
  name: string;
  /** Optional description for the option */
  description?: string;
}

interface AddMarketOptionResult {
  /** Signature of the transaction */
  signature: string;
  /** PDA of the created option account */
  optionPda: string;
}

/**
 * Hook to add a new option to a conviction market
 *
 * This hook handles the transaction to add an option:
 * 1. Builds the add option transaction
 * 2. Sends and confirms the transaction
 * 3. Saves the option to the database
 *
 * @returns Tanstack Query mutation with addOption function
 */
export function useAddMarketOption() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const mutation = useMutation({
    mutationFn: async (params: AddMarketOptionParams): Promise<AddMarketOptionResult> => {
      if (!wallet.publicKey || !wallet.sendTransaction) {
        throw new Error("Wallet not connected");
      }

      // STEP 1: Build the transaction
      console.log("Building add market option transaction...");
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: "confirmed" }
      );

      const { transaction, optionPda } = await addMarketOption(provider, {
        creator: wallet.publicKey,
        market: params.market,
        optionIndex: params.optionIndex,
        name: params.name,
      });

      // STEP 2: Send and confirm the transaction
      const signature = await wallet.sendTransaction(transaction, connection);
      console.log("Add market option transaction sent:", signature);

      await connection.confirmTransaction(signature, "confirmed");
      console.log("Option added on-chain successfully");

      // STEP 3: Insert option into database
      console.log("Saving option to database...");
      const { success, error: insertError } = await insertOption({
        address: optionPda.toBase58(),
        marketAddress: params.market.toBase58(),
        name: params.name,
        description: params.description ?? "",
        creatorPubkey: wallet.publicKey.toBase58(),
        signature,
      });

      if (!success) {
        console.error("Warning: Option added on-chain but database insert failed:", insertError);
        // Still return success since blockchain tx succeeded
      } else {
        console.log("Option saved to database successfully");
      }

      return {
        signature,
        optionPda: optionPda.toBase58(),
      };
    },
  });

  return {
    addOption: mutation.mutate,
    addOptionAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
