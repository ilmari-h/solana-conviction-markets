"use client";

import { useMutation } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  deriveVoteTokenAccountPda,
  claimVoteTokens,
  awaitComputationFinalization,
} from "@bench.games/conviction-markets";
import { useDeriveX25519 } from "./use-derive-x25519";

interface SellVoteTokensParams {
  /** Number of vote tokens to sell */
  amount: number;
}

interface SellVoteTokensResult {
  /** Signature of claim vote tokens transaction */
  claimSignature: string;
  /** Amount of tokens sold */
  amount: number;
}

/**
 * Hook to sell vote tokens for SOL
 *
 * This hook handles the complete flow:
 * 1. Checks if user has a vote token account PDA (errors if not found)
 * 2. Claims vote tokens via MPC (claimVoteTokens)
 * 3. Waits for MPC computation finalization
 * 4. Transfers SOL back to user
 *
 * @returns Tanstack Query mutation with sellVoteTokens function
 */
export function useSellVoteTokens() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { keypair: x25519Keypair, isReady: isKeypairReady } = useDeriveX25519();

  const mutation = useMutation({
    mutationFn: async ({ amount }: SellVoteTokensParams): Promise<SellVoteTokensResult> => {
      if (!wallet.publicKey || !wallet.sendTransaction) {
        throw new Error("Wallet not connected");
      }

      if (!isKeypairReady || !x25519Keypair) {
        throw new Error("Encryption keypair not ready. Please sign the message to generate your keypair.");
      }

      // Create anchor provider without Keypair (wallet adapter will handle signing)
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: "confirmed" }
      );

      // Derive vote token account PDA
      const [voteTokenAccountPda] = deriveVoteTokenAccountPda(wallet.publicKey);

      // Check if vote token account exists
      const accountInfo = await connection.getAccountInfo(voteTokenAccountPda);
      if (!accountInfo) {
        throw new Error(
          "Vote token account not found. You must buy vote tokens first before selling."
        );
      }

      console.log(`Selling ${amount} vote tokens for SOL...`);

      const { transaction, computationOffset } = await claimVoteTokens(provider, {
        signer: wallet.publicKey,
        userX25519Keypair: x25519Keypair,
        amount,
      });

      // Send transaction using wallet adapter
      const claimSignature = await wallet.sendTransaction(transaction, connection);
      console.log("Claim vote tokens transaction sent:", claimSignature);

      // Wait for transaction confirmation
      await connection.confirmTransaction(claimSignature, "confirmed");
      console.log("Transaction confirmed:", claimSignature);

      // Wait for MPC computation to finalize
      console.log("Waiting for MPC claim computation to finalize...");
      await awaitComputationFinalization(provider, computationOffset);
      console.log("Claim computation finalized");

      return {
        claimSignature,
        amount,
      };
    },
  });

  return {
    sellVoteTokens: mutation.mutate,
    sellVoteTokensAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
