"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownUp } from "lucide-react";
import { useSolBalance } from "@/hooks/use-sol-balance";
import { PRICE_PER_VOTE_TOKEN_LAMPORTS } from "@/lib/constants";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

interface TokenSwapProps {
  voteTokenBalance?: number;
}

export function TokenSwap({ voteTokenBalance = 1234 }: TokenSwapProps) {
  const [swapDirection, setSwapDirection] = useState<"buy" | "sell">("buy");
  const [inputAmount, setInputAmount] = useState("");
  const { balanceInSol } = useSolBalance();

  const toggleSwapDirection = () => {
    setSwapDirection((prev) => (prev === "buy" ? "sell" : "buy"));
    setInputAmount("");
  };

  const handleMaxClick = () => {
    if (swapDirection === "buy") {
      setInputAmount(balanceInSol.toFixed(9));
    } else {
      setInputAmount(voteTokenBalance.toString());
    }
  };

  // Calculate price in SOL (lamports to SOL conversion)
  const pricePerVoteTokenInSol =
    Number(PRICE_PER_VOTE_TOKEN_LAMPORTS) / LAMPORTS_PER_SOL;

  // Calculate output amount based on input and direction
  const outputAmount = useMemo(() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) return "";

    const input = parseFloat(inputAmount);

    if (swapDirection === "buy") {
      // Buying VOTE with SOL: SOL / price = VOTE
      const voteTokens = input / pricePerVoteTokenInSol;
      return voteTokens.toFixed(0);
    } else {
      // Selling VOTE for SOL: VOTE * price = SOL
      const sol = input * pricePerVoteTokenInSol;
      return sol.toFixed(9);
    }
  }, [inputAmount, swapDirection, pricePerVoteTokenInSol]);

  const fromToken = swapDirection === "buy" ? "SOL" : "VOTE";
  const toToken = swapDirection === "buy" ? "VOTE" : "SOL";
  const fromBalance =
    swapDirection === "buy" ? balanceInSol : voteTokenBalance;
  const toBalance = swapDirection === "buy" ? voteTokenBalance : balanceInSol;

  return (
    <Card className="p-4 bg-card border-border space-y-3 gap-2">
      {/* From Token Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>From</span>
          <span className="font-mono">
            Balance: {fromBalance.toLocaleString(undefined, {
              maximumFractionDigits: fromToken === "SOL" ? 9 : 0
            })}{" "}
            {fromToken}
          </span>
        </div>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.0"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            className="pr-24 text-lg font-medium"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMaxClick}
              className="h-6 px-2 text-xs text-accent hover:text-accent/80"
            >
              MAX
            </Button>
            <span className="font-medium text-sm text-foreground">
              {fromToken}
            </span>
          </div>
        </div>
      </div>

      {/* Swap Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSwapDirection}
          className="rounded-full border-border hover:border-accent hover:bg-accent/10 transition-all"
        >
          <ArrowDownUp className="w-4 h-4" />
        </Button>
      </div>

      {/* To Token Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>To</span>
          <span className="font-mono">
            Balance: {toBalance.toLocaleString(undefined, {
              maximumFractionDigits: toToken === "SOL" ? 9 : 0
            })}{" "}
            {toToken}
          </span>
        </div>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.0"
            disabled
            value={outputAmount}
            className="pr-16 text-lg font-medium bg-secondary/30"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <span className="font-medium text-sm text-foreground">
              {toToken}
            </span>
          </div>
        </div>
      </div>

      {/* Price Info */}
      <div className="flex items-center justify-center text-xs text-muted-foreground">
        <span>
          1 VOTE = {pricePerVoteTokenInSol.toFixed(6)} SOL
        </span>
      </div>

      {/* Swap Action Button */}
      <div className="pt-2">
        <Button
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          disabled={!inputAmount || parseFloat(inputAmount) <= 0}
        >
          Swap {fromToken} → {toToken}
        </Button>
      </div>
    </Card>
  );
}
