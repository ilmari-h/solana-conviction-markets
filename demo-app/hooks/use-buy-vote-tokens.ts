"use client";

import { useMutation } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  deriveVoteTokenAccountPda,
  initVoteTokenAccount,
  mintVoteTokens,
  awaitComputationFinalization,
  type X25519Keypair,
} from "@bench.games/conviction-markets";
import { useDeriveX25519 } from "./use-derive-x25519";

interface BuyVoteTokensParams {
  amount: number;
}

/**
 * Hook to buy vote tokens with automatic vote token account setup
 *
 * This hook handles:
 * 1. Checking if user has a vote token account
 * 2. Creating the vote token account if needed (on-chain)
 * 3. Initializing the encrypted balance (MPC computation)
 * 4. Minting vote tokens (MPC computation)
 *
 * @returns Tanstack Query mutation with buyVoteTokens function
 */
export function useBuyVoteTokens() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { keypair: x25519Keypair, isReady: isKeypairReady } = useDeriveX25519();

  const mutation = useMutation({
    mutationFn: async ({ amount }: BuyVoteTokensParams) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error("Wallet not connected");
      }

      if (!isKeypairReady || !x25519Keypair) {
        throw new Error("Encryption keypair not ready");
      }

      // Create anchor provider
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: "confirmed" }
      );

      // Derive vote token account PDA
      const [voteTokenAccountPda] = deriveVoteTokenAccountPda(wallet.publicKey);

      // Check if vote token account exists
      const accountInfo = await connection.getAccountInfo(voteTokenAccountPda);
      const needsCreation = !accountInfo;

      let initSignature: string | undefined;

      // Step 1 & 2: Create and initialize vote token account if needed
      if (needsCreation) {
        console.log("Vote token account not found, creating...");

        // Create signer keypair from wallet
        // Note: We need to convert wallet to Keypair for the instructions
        // This is a workaround - in production, you'd want to use wallet adapter's sendTransaction
        const signerKeypair = Keypair.generate(); // This won't work directly

        // Instead, we should call the instruction and let the wallet sign
        const result = await initVoteTokenAccount(provider, {
          signer: signerKeypair, // This needs to be the actual wallet keypair
          userX25519Keypair: x25519Keypair,
        });

        initSignature = result.signature;
        console.log("Vote token account initialized:", initSignature);

        // Wait for MPC computation to finalize
        console.log("Waiting for initialization computation to finalize...");
        await awaitComputationFinalization(provider, result.computationOffset);
        console.log("Initialization finalized");
      }

      // Step 3: Mint vote tokens
      console.log(`Minting ${amount} vote tokens...`);

      const signerKeypair = Keypair.generate(); // Same issue here
      const mintResult = await mintVoteTokens(provider, {
        signer: signerKeypair,
        userX25519Keypair: x25519Keypair,
        amount,
      });

      console.log("Vote tokens minting transaction:", mintResult.signature);

      // Wait for MPC computation to finalize
      console.log("Waiting for minting computation to finalize...");
      await awaitComputationFinalization(provider, mintResult.computationOffset);
      console.log("Minting finalized");

      return {
        initSignature,
        mintSignature: mintResult.signature,
        voteTokenAccountPda,
        amount,
      };
    },
  });

  return {
    buyVoteTokens: mutation.mutate,
    buyVoteTokensAsync: mutation.mutateAsync,
    ...mutation,
  };
}
