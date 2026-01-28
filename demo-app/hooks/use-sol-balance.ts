import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

interface UseSolBalanceOptions {
  excludeRent?: boolean;
}

export function useSolBalance(
  address?: PublicKey | string,
  options: UseSolBalanceOptions = {}
) {
  const { excludeRent = false } = options;
  const { connection } = useConnection();
  const { publicKey: walletPublicKey } = useWallet();

  // Stabilize the address string to prevent effect re-runs
  const addressString = address
    ? typeof address === "string"
      ? address
      : address.toBase58()
    : walletPublicKey?.toBase58() ?? null;

  const targetPubkey = useMemo(
    () => (addressString ? new PublicKey(addressString) : null),
    [addressString]
  );

  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [rentExemptMin, setRentExemptMin] = useState<bigint>(BigInt(0));
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!targetPubkey) {
      setBalance(BigInt(0));
      setRentExemptMin(BigInt(0));
      setLoading(false);
      return;
    }

    // Only set loading on first fetch or address change
    if (!hasFetched.current) {
      setLoading(true);
    }

    let cancelled = false;

    const fetchBalance = async () => {
      try {
        const accountInfo = await connection.getAccountInfo(targetPubkey);
        if (cancelled) return;

        if (accountInfo) {
          setBalance(BigInt(accountInfo.lamports));
          // Get minimum rent for this account's data size
          const minRent = await connection.getMinimumBalanceForRentExemption(
            accountInfo.data.length
          );
          if (!cancelled) {
            setRentExemptMin(BigInt(minRent));
          }
        } else {
          setBalance(BigInt(0));
          setRentExemptMin(BigInt(0));
        }
        hasFetched.current = true;
      } catch (error) {
        console.error("Error fetching SOL balance:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBalance();

    // Subscribe to account changes
    const subscriptionId = connection.onAccountChange(
      targetPubkey,
      async (accountInfo) => {
        if (!cancelled) {
          setBalance(BigInt(accountInfo.lamports));
          // Update rent if data size changed
          const minRent = await connection.getMinimumBalanceForRentExemption(
            accountInfo.data.length
          );
          if (!cancelled) {
            setRentExemptMin(BigInt(minRent));
          }
        }
      }
    );

    return () => {
      cancelled = true;
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [targetPubkey, connection]);

  // Calculate effective balance (excluding rent if requested)
  const effectiveBalance = excludeRent
    ? balance > rentExemptMin
      ? balance - rentExemptMin
      : BigInt(0)
    : balance;

  return {
    balance: effectiveBalance, // in lamports (bigint)
    balanceInSol: Number(effectiveBalance) / LAMPORTS_PER_SOL,
    loading,
  };
}
