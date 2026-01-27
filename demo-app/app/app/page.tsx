import { db } from "@/db/client";
import { MarketsDashboard } from "@/components/markets-dashboard";
import { fetchAllMarkets } from "@bench.games/conviction-markets";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

export default async function AppPage() {
  // Fetch DB markets for name/description
  const dbMarkets = await db.query.markets.findMany({
    orderBy: (markets, { desc }) => [desc(markets.createdAt)],
    with: {
      options: true,
    },
  });

  // Create a lookup map by address
  const dbMarketMap = new Map(
    dbMarkets.map((m) => [m.address, m])
  );

  // Fetch on-chain markets
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: Keypair.generate().publicKey,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    },
    { commitment: "confirmed" }
  );
  const onChainMarkets = await fetchAllMarkets(provider);

  // Merge on-chain data with DB metadata
  const mergedMarkets = onChainMarkets.map((onChain) => {
    const address = onChain.publicKey.toBase58();
    const dbData = dbMarketMap.get(address);

    return {
      address,
      name: dbData?.name ?? `Market #${onChain.account.index.toString()}`,
      description: dbData?.description ?? "",
      creatorPubkey: onChain.account.creator.toBase58(),
      rewardSol: Number(onChain.account.rewardLamports) / LAMPORTS_PER_SOL,
      marketIndex: onChain.account.index.toString(),
      totalOptions: onChain.account.totalOptions,
      maxOptions: onChain.account.maxOptions,
      maxShares: onChain.account.maxShares.toString(),
      openTimestamp: onChain.account.openTimestamp?.toString() ?? null,
      timeToStake: onChain.account.timeToStake.toString(),
      timeToReveal: onChain.account.timeToReveal.toString(),
      selectedOption: onChain.account.selectedOption ?? null,
      options: dbData?.options ?? [],
    };
  });

  return <MarketsDashboard markets={mergedMarkets} />;
}
