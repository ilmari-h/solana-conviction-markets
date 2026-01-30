"use client";

import { useMutation } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { closeShareAccount } from "@bench.games/conviction-markets";

interface ClaimRewardParams {
  /** Market to claim reward from */
  market: PublicKey;
  /** Option index that was voted for (1-indexed) */
  optionIndex: number;
}

interface ClaimRewardResult {
  /** Signature of claim reward transaction */
  signature: string;
}

/**
 * Hook to claim reward after market is resolved
 *
 * This hook handles the complete flow:
 * 1. Validates wallet connection
 * 2. Builds and sends closeShareAccount transaction
 * 3. Closes the share account and transfers reward (if eligible)
 *
 * @returns Tanstack Query mutation with claimReward function
 */
export function useClaimReward() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const mutation = useMutation({
    mutationFn: async ({ market, optionIndex }: ClaimRewardParams): Promise<ClaimRewardResult> => {
      if (!wallet.publicKey || !wallet.sendTransaction) {
        throw new Error("Wallet not connected");
      }

      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: "confirmed" }
      );

      console.log("Claiming reward for market:", market.toBase58(), "optionIndex:", optionIndex);

      const { transaction } = await closeShareAccount(provider, {
        owner: wallet.publicKey,
        market,
        optionIndex,
      });

      try {
        const signature = await wallet.sendTransaction(transaction, connection);
        console.log("Claim reward transaction sent:", signature);

        await connection.confirmTransaction(signature, "confirmed");
        console.log("Transaction confirmed:", signature);

        return { signature };
      } catch(err) {
        console.log("Err" ,err )
        throw(err)
      }
    },
  });

  return {
    claimReward: mutation.mutate,
    claimRewardAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
