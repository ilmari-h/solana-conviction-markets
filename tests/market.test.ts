import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { address, some, isSome } from "@solana/kit";
import { fetchToken, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { expect } from "chai";

import { OpportunityMarket } from "../target/types/opportunity_market";
import { TestRunner } from "./utils/test-runner";
import { initializeAllCompDefs } from "./utils/comp-defs";
import { sleepUntilOnChainTimestamp } from "./utils/sleep";

import * as fs from "fs";
import * as os from "os";

const ONCHAIN_TIMESTAMP_BUFFER_SECONDS = 6;

// Environment setup
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || "http://127.0.0.1:8899";
const WS_URL = RPC_URL.replace("http", "ws").replace(":8899", ":8900");

describe("OpportunityMarket", () => {
  // Anchor setup (still needed for buildFinalizeCompDefTx)
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.OpportunityMarket as Program<OpportunityMarket>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  const programId = address(program.programId.toBase58());

  before(async () => {
    // Load owner secret key
    const file = fs.readFileSync(`${os.homedir()}/.config/solana/id.json`);
    const secretKey = new Uint8Array(JSON.parse(file.toString()));

    // Initialize all computation definitions
    const { createSolanaRpc, createSolanaRpcSubscriptions, sendAndConfirmTransactionFactory } = await import("@solana/kit");
    const rpc = createSolanaRpc(RPC_URL);
    const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

    await initializeAllCompDefs(rpc, sendAndConfirmTransaction, secretKey, programId);
  });

  it("passes full opportunity market flow", async () => {
    const marketFundingAmount = 1_000_000_000n;
    const numParticipants = 4;
    const minDeposit = 1n;

    // Initialize TestRunner with all accounts and market
    const runner = await TestRunner.initialize(provider, programId, {
      rpcUrl: RPC_URL,
      wsUrl: WS_URL,
      numParticipants,
      airdropLamports: 2_000_000_000n,
      initialTokenAmount: 2_000_000_000n,
      marketConfig: {
        rewardAmount: marketFundingAmount,
        timeToStake: 120n,
        timeToReveal: 25n,
      },
    });

    // Fund and open market
    await runner.fundMarket();
    const openTimestamp = await runner.openMarket();

    // Initialize VTAs and mint vote tokens for all participants
    const mintAmount = 100_000_000n;
    for (const userId of runner.participants) {
      await runner.initVoteTokenAccount(userId);
      await runner.mintVoteTokens(userId, mintAmount);
    }

    // Creator also needs VTA to add options
    await runner.initVoteTokenAccount(runner.creator);
    await runner.mintVoteTokens(runner.creator, 100n);

    // Wait for market staking period to be active
    await sleepUntilOnChainTimestamp(Number(openTimestamp) + ONCHAIN_TIMESTAMP_BUFFER_SECONDS);

    // Add two options (creator deposits minDeposit for each)
    const { optionIndex: optionA, shareAccountId: creatorShareA } = await runner.addMarketOption(
      runner.creator,
      "Option A",
      minDeposit
    );
    const { optionIndex: optionB, shareAccountId: creatorShareB } = await runner.addMarketOption(
      runner.creator,
      "Option B",
      minDeposit
    );

    // Define voting: first half vote Option A (winning), second half vote Option B
    const winningOptionIndex = optionA;
    const buySharesAmounts = [50n, 75n, 100n, 60n];

    // Buy shares for all participants
    const purchases = runner.participants.map((userId, idx) => ({
      userId,
      amount: buySharesAmounts[idx],
      optionIndex: idx < numParticipants / 2 ? optionA : optionB,
    }));
    // TODO: mutate internal state accounts with shares
    const shareIds = await runner.buySharesBatch(purchases);

    // Market creator selects winning option
    await runner.selectOption(winningOptionIndex);

    // Verify selected option
    const resolvedMarket = await runner.fetchMarket();
    expect(resolvedMarket.data.selectedOption).to.deep.equal(some(winningOptionIndex));

    // Reveal shares for winners (first half who voted Option A)
    const winnerIndices = [0, 1];
    const winners = winnerIndices.map((i) => runner.participants[i]);
    const winnerShareIds = winnerIndices.map((i) => shareIds[i]);
    const winnerAmounts = winnerIndices.map((i) => buySharesAmounts[i]);

    await runner.revealSharesBatch(
      winners.map((userId, i) => ({ userId, shareAccountId: winnerShareIds[i] }))
    );

    // Reveal creator's share accounts
    await runner.revealSharesBatch([
      { userId: runner.creator, shareAccountId: creatorShareA },
      { userId: runner.creator, shareAccountId: creatorShareB },
    ]);

    // Verify revealed shares for winners
    for (let i = 0; i < winners.length; i++) {
      const shareAccount = await runner.fetchShareAccountData(winners[i], winnerShareIds[i]);
      expect(shareAccount.data.revealedAmount).to.deep.equal(some(winnerAmounts[i]));
      expect(shareAccount.data.revealedOption).to.deep.equal(some(winningOptionIndex));
    }

    // Verify creator's revealed shares
    const creatorShareAAccount = await runner.fetchShareAccountData(runner.creator, creatorShareA);
    expect(creatorShareAAccount.data.revealedAmount).to.deep.equal(some(minDeposit));
    expect(creatorShareAAccount.data.revealedOption).to.deep.equal(some(optionA));

    const creatorShareBAccount = await runner.fetchShareAccountData(runner.creator, creatorShareB);
    expect(creatorShareBAccount.data.revealedAmount).to.deep.equal(some(minDeposit));
    expect(creatorShareBAccount.data.revealedOption).to.deep.equal(some(optionB));

    // Increment option tally for winners
    await runner.incrementOptionTallyBatch(
      winners.map((userId, i) => ({
        userId,
        optionIndex: winningOptionIndex,
        shareAccountId: winnerShareIds[i],
      }))
    );

    // Increment tally for creator's share accounts
    await runner.incrementOptionTallyBatch([
      { userId: runner.creator, optionIndex: optionA, shareAccountId: creatorShareA },
      { userId: runner.creator, optionIndex: optionB, shareAccountId: creatorShareB },
    ]);

    // Verify option tally
    const totalWinningShares = winnerAmounts.reduce((a, b) => a + b, 0n) + minDeposit;
    const optionAccount = await runner.fetchOptionData(winningOptionIndex);
    expect(optionAccount.data.totalShares).to.deep.equal(some(totalWinningShares));

    // Get timestamps for reward calculation
    const updatedMarket = await runner.fetchMarket();
    const marketCloseTimestamp =
      BigInt(
        updatedMarket.data.openTimestamp.__option === "Some"
          ? updatedMarket.data.openTimestamp.value
          : 0n
      ) + updatedMarket.data.timeToStake;

    const winnerTimestamps = await Promise.all(
      winners.map(async (userId, i) => {
        const shareAccount = await runner.fetchShareAccountData(userId, winnerShareIds[i]);
        const ts = shareAccount.data.stakedAtTimestamp;
        if (!isSome(ts)) throw new Error("stakedAtTimestamp is None");
        return ts.value;
      })
    );

    // Wait for reveal period to end
    const timeToReveal = Number(runner.getTimeToReveal());
    await sleepUntilOnChainTimestamp(new Date().getTime() / 1000 + timeToReveal);

    // Get token balances before closing
    const rpc = runner.getRpc();
    const marketAta = await runner.getMarketAta();

    const balancesBefore = await Promise.all(
      winners.map(async (userId) => ({
        userId,
        balance: (await fetchToken(rpc, runner.getUserTokenAccount(userId))).data.amount,
      }))
    );
    const creatorBalanceBefore = (await fetchToken(rpc, runner.getUserTokenAccount(runner.creator)))
      .data.amount;
    const marketBalanceBefore = (await fetchToken(rpc, marketAta)).data.amount;

    // Close share accounts for winners
    await runner.closeShareAccountBatch(
      winners.map((userId, i) => ({
        userId,
        optionIndex: winningOptionIndex,
        shareAccountId: winnerShareIds[i],
      }))
    );

    // Close creator's share accounts
    await runner.closeShareAccountBatch([
      { userId: runner.creator, optionIndex: optionA, shareAccountId: creatorShareA },
      { userId: runner.creator, optionIndex: optionB, shareAccountId: creatorShareB },
    ]);

    // Verify share accounts were closed
    for (let i = 0; i < winners.length; i++) {
      const address = await runner.getShareAccountAddress(winners[i], winnerShareIds[i]);
      const exists = await runner.accountExists(address);
      expect(exists).to.be.false;
    }

    // Get token balances after closing
    const balancesAfter = await Promise.all(
      winners.map(async (userId) => ({
        userId,
        balance: (await fetchToken(rpc, runner.getUserTokenAccount(userId))).data.amount,
      }))
    );
    const creatorBalanceAfter = (await fetchToken(rpc, runner.getUserTokenAccount(runner.creator)))
      .data.amount;
    const marketBalanceAfter = (await fetchToken(rpc, marketAta)).data.amount;

    // Calculate gains
    const gains = winners.map((userId, i) => ({
      userId,
      gain: balancesAfter[i].balance - balancesBefore[i].balance,
      shares: winnerAmounts[i],
    }));
    const creatorGain = creatorBalanceAfter - creatorBalanceBefore;

    // All winners should have gained funds
    for (const { gain } of gains) {
      expect(gain > 0n).to.be.true;
    }

    // Total market loss should equal the full reward amount (tolerance of 2 for rounding)
    const marketLoss = marketBalanceBefore - marketBalanceAfter;
    expect(marketLoss >= marketFundingAmount - 2n && marketLoss <= marketFundingAmount).to.be.true;

    // Verify proportional reward distribution
    const winnerScores = gains.map(({ gain, shares }, i) => ({
      gain,
      score: shares * (marketCloseTimestamp - winnerTimestamps[i]),
    }));

    winnerScores.forEach((a, i) =>
      winnerScores.slice(i + 1).forEach((b, j) => {
        const lhs = a.gain * b.score;
        const rhs = b.gain * a.score;
        const tolerance = (lhs > rhs ? lhs : rhs) / 100n; // 1%
        expect(
          Math.abs(Number(lhs - rhs)) <= tolerance,
          `Reward ratio mismatch between winner ${i} and ${i + j + 1}: ${lhs} - ${rhs}`
        ).to.be.true;
      })
    );

    // Verify total gains equal reward amount
    const totalGains = gains.reduce((sum, { gain }) => sum + gain, 0n) + creatorGain;
    expect(totalGains >= marketFundingAmount - 2n).to.be.true;
    expect(totalGains <= marketFundingAmount).to.be.true;
  });
});
