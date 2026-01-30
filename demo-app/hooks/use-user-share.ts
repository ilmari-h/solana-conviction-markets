"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { getUserShareForMarket } from "@/app/actions/markets";
import type { UserShare } from "@/lib/types";

export function useUserShare(marketAddress: string) {
  const { publicKey } = useWallet();

  const query = useQuery({
    queryKey: ["userShare", publicKey?.toBase58(), marketAddress],
    queryFn: async (): Promise<UserShare | null> => {
      if (!publicKey) {
        return null;
      }

      const result = await getUserShareForMarket(
        publicKey.toBase58(),
        marketAddress
      );

      if (result.error) {
        console.error("Error fetching user share:", result.error);
        return null;
      }

      if (!result.share) {
        return null;
      }

      return {
        optionAddress: result.share.optionAddress,
        amount: result.share.amount,
        revealedInTime: result.share.revealedInTime,
        claimedYield: result.share.claimedYield,
      };
    },
    enabled: !!publicKey && !!marketAddress,
    staleTime: 5000,
  });

  return {
    share: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
