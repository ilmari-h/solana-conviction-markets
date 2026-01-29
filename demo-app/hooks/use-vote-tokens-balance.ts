"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  deriveVoteTokenAccountPda,
  createProgram,
  fetchAndDecryptVoteTokenBalance,
} from "@bench.games/conviction-markets";
import { useDeriveX25519 } from "./use-derive-x25519";

/**
 * Hook to fetch and decrypt user's vote token balance
 *
 * Returns the decrypted vote token balance for the connected wallet.
 * Requires an encryption keypair to decrypt the balance.
 *
 * @returns Query result with decrypted balance or null if account doesn't exist
 */
export function useVoteTokensBalance() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { keypair: x25519Keypair, isReady: isKeypairReady } = useDeriveX25519();

  const query = useQuery({
    queryKey: [
      "voteTokenBalance",
      wallet.publicKey?.toBase58(),
      isKeypairReady,
    ],
    queryFn: async () => {
      if (!wallet.publicKey) {
        return null;
      }

      if (!isKeypairReady || !x25519Keypair) {
        throw new Error(
          "Encryption keypair not ready. Please sign the message to generate your keypair."
        );
      }

      // Create anchor provider
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });

      // Create program instance
      const program = createProgram(provider);

      // Derive vote token account PDA
      const [voteTokenAccountPda] = deriveVoteTokenAccountPda(wallet.publicKey);

      // Check if account exists
      const accountInfo = await connection.getAccountInfo(voteTokenAccountPda);
      if (!accountInfo) {
        // Account doesn't exist yet, return 0 balance
        return {
          balance: BigInt(0),
          accountExists: false,
        };
      }

      // Fetch and decrypt balance (MXE public key is fetched internally)
      const { balance, account } = await fetchAndDecryptVoteTokenBalance(
        program,
        voteTokenAccountPda,
        x25519Keypair
      );

      return {
        balance: account.stateNonce.eqn(0) ? BigInt(0) : balance,
        accountExists: !account.stateNonce.eqn(0),
        account,
      };
    },
    enabled: !!wallet.publicKey && isKeypairReady,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  return {
    balance: query.data?.balance ?? null,
    accountExists: query.data?.accountExists ?? false,
    account: query.data?.account ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
