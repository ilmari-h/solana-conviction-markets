"use client";

import { useMutation } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  deriveShareAccountPda,
  initShareAccount,
  buyMarketShares,
  awaitComputationFinalization,
} from "@bench.games/conviction-markets";
import { useDeriveX25519 } from "./use-derive-x25519";
import { insertShare } from "@/app/actions/markets";

interface BuySharesParams {
  market: PublicKey;
  optionAddress: string;
  optionIndex: number;
  amount: number;
}

interface BuySharesResult {
  initSignature?: string;
  buySignature: string;
  amount: number;
  optionAddress: string;
}

export function useBuyShares() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { keypair: x25519Keypair, isReady: isKeypairReady } = useDeriveX25519();

  const mutation = useMutation({
    mutationFn: async ({
      market,
      optionAddress,
      optionIndex,
      amount,
    }: BuySharesParams): Promise<BuySharesResult> => {
      if (!wallet.publicKey || !wallet.sendTransaction) {
        throw new Error("Wallet not connected");
      }

      if (!isKeypairReady || !x25519Keypair) {
        throw new Error(
          "Encryption keypair not ready. Please sign the message to generate your keypair."
        );
      }

      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      const [shareAccountPda] = deriveShareAccountPda(wallet.publicKey, market);

      // Check if share account exists
      const accountInfo = await connection.getAccountInfo(shareAccountPda);
      const needsInitialization = !accountInfo;

      let initSignature: string | undefined;

      // Step 1: Initialize share account if needed
      if (needsInitialization) {
        console.log("Share account not found, initializing...");

        const { transaction } = await initShareAccount(provider, {
          signer: wallet.publicKey,
          market,
        });

        const signature = await wallet.sendTransaction(transaction, connection);
        console.log("Init share account transaction sent:", signature);

        await connection.confirmTransaction(signature, "confirmed");
        console.log("Init share account confirmed:", signature);

        initSignature = signature;
      } else {
        console.log("Share account already exists, skipping initialization");
      }

      // Step 2: Buy market shares
      console.log(`Buying ${amount} shares for option index ${optionIndex}...`);

      const { transaction, computationOffset } = await buyMarketShares(
        provider,
        {
          signer: wallet.publicKey,
          userX25519Keypair: x25519Keypair,
          market,
          amount,
          selectedOption: optionIndex,
        }
      );

      const buySignature = await wallet.sendTransaction(transaction, connection);
      console.log("Buy shares transaction sent:", buySignature);

      await connection.confirmTransaction(buySignature, "confirmed");
      console.log("Buy shares confirmed:", buySignature);

      // Wait for MPC computation to finalize
      console.log("Waiting for MPC computation to finalize...");
      await awaitComputationFinalization(provider, computationOffset);
      console.log("Computation finalized");

      // Step 3: Insert share into database
      console.log("Inserting share into database...");
      const dbResult = await insertShare({
        userPubkey: wallet.publicKey.toBase58(),
        marketAddress: market.toBase58(),
        optionAddress,
        amount: amount.toString(),
        signature: buySignature,
      });

      if (!dbResult.success) {
        console.error("Failed to insert share into database:", dbResult.error);
        // Don't throw - the blockchain transaction succeeded
      }

      return {
        initSignature,
        buySignature,
        amount,
        optionAddress,
      };
    },
  });

  return {
    buyShares: mutation.mutate,
    buySharesAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
