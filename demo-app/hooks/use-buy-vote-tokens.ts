"use client";

import { useMutation } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  deriveVoteTokenAccountPda,
  initVoteTokenAccount,
  mintVoteTokens,
  awaitComputationFinalization,
} from "@bench.games/conviction-markets";
import { useDeriveX25519 } from "./use-derive-x25519";

interface BuyVoteTokensParams {
  /** Number of vote tokens to buy */
  amount: number;
}

interface BuyVoteTokensResult {
  /** Signature of vote token account creation (if created) */
  createAccountSignature?: string;
  /** Signature of init vote token account transaction (if needed) */
  initSignature?: string;
  /** Signature of mint vote tokens transaction */
  mintSignature: string;
  /** Amount of tokens minted */
  amount: number;
}

/**
 * Hook to buy vote tokens with automatic account setup
 *
 * This hook handles the complete flow:
 * 1. Checks if user has a vote token account PDA
 * 2. Creates the PDA account if needed (on-chain account creation)
 * 3. Initializes encrypted balance via MPC (initVoteTokenAccount)
 * 4. Mints vote tokens via MPC (mintVoteTokens)
 * 5. Waits for MPC computation finalization after each step
 *
 * @returns Tanstack Query mutation with buyVoteTokens function
 */
export function useBuyVoteTokens() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { keypair: x25519Keypair, isReady: isKeypairReady } = useDeriveX25519();

  const mutation = useMutation({
    mutationFn: async ({ amount }: BuyVoteTokensParams): Promise<BuyVoteTokensResult> => {
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
      const needsInitialization = !accountInfo;

      let initSignature: string | undefined;

      // Step 1: Initialize vote token account if needed
      if (needsInitialization) {
        console.log("Vote token account not found, initializing...");

        const { transaction, computationOffset } = await initVoteTokenAccount(provider, {
          signer: wallet.publicKey,
          userX25519Keypair: x25519Keypair,
        });

        // Send transaction using wallet adapter
        const signature = await wallet.sendTransaction(transaction, connection);
        console.log("Init vote token account transaction sent:", signature);

        // Wait for transaction confirmation
        await connection.confirmTransaction(signature, "confirmed");
        console.log("Transaction confirmed:", signature);

        initSignature = signature;

        // Wait for MPC computation to finalize
        console.log("Waiting for MPC initialization computation to finalize...");
        await awaitComputationFinalization(provider, computationOffset);
        console.log("Initialization computation finalized");
      } else {
        console.log("Vote token account already exists, skipping initialization");
      }

      // Step 2: Mint vote tokens
      console.log(`Minting ${amount} vote tokens...`);

      const { transaction, computationOffset } = await mintVoteTokens(provider, {
        signer: wallet.publicKey,
        userX25519Keypair: x25519Keypair,
        amount,
      });

      // Send transaction using wallet adapter
      const mintSignature = await wallet.sendTransaction(transaction, connection);
      console.log("Mint vote tokens transaction sent:", mintSignature);

      // Wait for transaction confirmation
      await connection.confirmTransaction(mintSignature, "confirmed");
      console.log("Transaction confirmed:", mintSignature);

      // Wait for MPC computation to finalize
      console.log("Waiting for MPC minting computation to finalize...");
      await awaitComputationFinalization(provider, computationOffset);
      console.log("Minting computation finalized");

      return {
        initSignature,
        mintSignature,
        amount,
      };
    },
  });

  return {
    buyVoteTokens: mutation.mutate,
    buyVoteTokensAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
