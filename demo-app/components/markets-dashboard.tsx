"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Coins, ExternalLink, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TokenSwap } from "@/components/token-swap";
import { CreateMarketDialog } from "@/components/create-market-dialog";
import { Info } from "lucide-react";
import type { MergedMarket, MarketStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  MarketStatus,
  { label: string; className: string }
> = {
  not_funded: {
    label: "Not Funded",
    className: "border-muted-foreground/50 text-muted-foreground",
  },
  open: {
    label: "Open",
    className: "border-accent/50 text-accent",
  },
  revealing: {
    label: "Revealing",
    className: "border-amber-500/50 text-amber-500",
  },
  resolved: {
    label: "Resolved",
    className: "border-blue-500/50 text-blue-500",
  },
};

interface MarketsDashboardProps {
  markets: MergedMarket[];
}

export function MarketsDashboard({ markets }: MarketsDashboardProps) {
  const { connected, publicKey } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!connected) {
      router.push("/");
    }
  }, [connected, router]);

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!connected) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-light tracking-tight text-foreground">
              <span>Conviction Markets</span>
            </h1>
          </div>
          {publicKey && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs bg-secondary px-2 py-1 rounded">
                {truncateAddress(publicKey.toBase58())}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content - Markets */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">
                Active Markets
              </h2>
              <CreateMarketDialog />
            </div>

            <div className="space-y-4">
              {markets.map((market) => {
                const statusConfig = STATUS_CONFIG[market.status];
                return (
                  <Card
                    key={market.address}
                    className="p-5 bg-card border-border hover:border-accent/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/app/${market.address}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://solscan.io/account/${market.creatorPubkey}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-accent flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Created by {truncateAddress(market.creatorPubkey)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <h3 className="text-foreground font-medium">
                          {market.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {market.description}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 ${statusConfig.className}`}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <ListChecks className="w-4 h-4" />
                        <span>{market.totalOptions} options</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-4 h-4" />
                        <span>{market.rewardSol.toFixed(2)} SOL reward</span>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {markets.length === 0 && (
                <Card className="p-8 bg-card border-border text-center">
                  <p className="text-muted-foreground">
                    No active markets yet. Create the first one!
                  </p>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar - Token Swap */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-foreground mb-4">
                Your Vote Tokens
              </h2>
              <TokenSwap />
            </div>

            {/* Info card */}
            <Card className="p-4 bg-secondary/30 border-border">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    What are vote tokens?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vote tokens are used for staking in Conviction Markets.
                    They enable confidential staking: how much or for which option
                    you staked for is not revealed.
                    Vote tokens can always be swapped back to SOL at a constant price.
                    They are not tradable outside the platform.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
