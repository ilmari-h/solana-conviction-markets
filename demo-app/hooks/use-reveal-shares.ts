"use client";

import { useMutation } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  revealShares,
  awaitComputationFinalization,
  deriveShareAccountPda,
  incrementOptionTally,
  createProgram,
  fetchShareAccount,
} from "@bench.games/conviction-markets";
import { useDeriveX25519 } from "./use-derive-x25519";

interface RevealSharesParams {
  /** Market to reveal shares for */
  market: PublicKey;
}

interface RevealSharesResult {
  /** Signature of reveal shares transaction */
  revealSignature: string;
  /** Signature of increment option tally transaction */
  tallySignature: string;
  /** PDA of the share account */
  shareAccountPda: string;
}

/**
 * Hook to reveal shares during the revealing phase of a market
 *
 * This hook handles the complete flow:
 * 1. Validates wallet and encryption keypair
 * 2. Checks if share account exists (user has stake)
 * 3. Builds and sends revealShares transaction
 * 4. Waits for MPC computation finalization
 * 5. Returns vote tokens to user's balance
 *
 * @returns Tanstack Query mutation with revealShares function
 */
export function useRevealShares() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { keypair: x25519Keypair, isReady: isKeypairReady } = useDeriveX25519();

  const mutation = useMutation({
    mutationFn: async ({ market }: RevealSharesParams): Promise<RevealSharesResult> => {
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

      // Derive share account PDA
      const [shareAccountPda] = deriveShareAccountPda(wallet.publicKey, market);

      // Check if share account exists (user has stake in this market)
      const accountInfo = await connection.getAccountInfo(shareAccountPda);
      if (!accountInfo) {
        throw new Error(
          "Share account not found. You must have voted in this market to reveal your vote."
        );
      }
      const program = createProgram(provider);
      let shareAccount = await fetchShareAccount(program, shareAccountPda);

      if(shareAccount.revealedOption === null ){

        console.log("Revealing shares for market:", market.toBase58());

        const { transaction, computationOffset } = await revealShares(provider, {
          signer: wallet.publicKey,
          owner: wallet.publicKey,
          market,
          ownerX25519Keypair: x25519Keypair,
        });

        // Send transaction using wallet adapter
        const revealSignature = await wallet.sendTransaction(transaction, connection);
        console.log("Reveal shares transaction sent:", revealSignature);

        // Wait for transaction confirmation
        await connection.confirmTransaction(revealSignature, "confirmed");
        console.log("Transaction confirmed:", revealSignature);

        // Wait for MPC computation to finalize
        console.log("Waiting for MPC reveal computation to finalize...");
        await awaitComputationFinalization(provider, computationOffset);
        console.log("Reveal computation finalized");

        // Fetch the share account to get the revealed option
        shareAccount = await fetchShareAccount(program, shareAccountPda);

        if (shareAccount.revealedOption === null) {
          throw new Error("Share account does not have a revealed option");
        }
      }


      // Increment the option tally
      console.log("Incrementing option tally for option:", shareAccount.revealedOption);
      const { transaction: tallyTx } = await incrementOptionTally(provider, {
        market,
        owner: wallet.publicKey,
        optionIndex: shareAccount.revealedOption,
      });

      const tallySignature = await wallet.sendTransaction(tallyTx, connection);
      console.log("Increment option tally transaction sent:", tallySignature);

      await connection.confirmTransaction(tallySignature, "confirmed");
      console.log("Increment option tally confirmed:", tallySignature);

      return {
        revealSignature: tallySignature,
        tallySignature,
        shareAccountPda: shareAccountPda.toBase58(),
      };
    },
  });

  return {
    revealShares: mutation.mutate,
    revealSharesAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
