import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export function useSolBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setBalance(BigInt(0));
      return;
    }

    const fetchBalance = async () => {
      setLoading(true);
      try {
        const lamports = await connection.getBalance(publicKey);
        setBalance(BigInt(lamports));
      } catch (error) {
        console.error("Error fetching SOL balance:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();

    // Subscribe to account changes
    const subscriptionId = connection.onAccountChange(
      publicKey,
      (accountInfo) => {
        setBalance(BigInt(accountInfo.lamports));
      }
    );

    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [publicKey, connection]);

  return {
    balance, // in lamports (bigint)
    balanceInSol: Number(balance) / LAMPORTS_PER_SOL,
    loading,
  };
}
