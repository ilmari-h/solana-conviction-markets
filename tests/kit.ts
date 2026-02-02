/**
 * Solana Kit-based tests for OpportunityMarket program.
 *
 * This test file uses @solana/kit for transaction building and the generated
 * Codama client bindings from js/src/generated.
 *
 * Arcium PDA derivation uses @arcium-hq/client (which returns web3.js PublicKey)
 * and converts to Kit Address type.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  airdropFactory,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  lamports,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
} from "@solana/kit";
import { initVoteTokenAccount, randomComputationOffset } from "../js/src";
import {
  getArciumEnv,
  getCompDefAccOffset,
  getArciumAccountBaseSeed,
  getArciumProgramId,
  getMXEAccAddress,
  buildFinalizeCompDefTx,
  deserializeLE,
} from "@arcium-hq/client";
import { PublicKey } from "@solana/web3.js";
import { OpportunityMarket } from "../target/types/opportunity_market";
import * as fs from "fs";
import * as os from "os";
import { randomBytes } from "crypto";
import { expect } from "chai";

// Environment setup
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || "http://127.0.0.1:8899";
// WebSocket port is RPC port + 1 (8899 -> 8900)
const WS_URL = RPC_URL.replace("http", "ws").replace(":8899", ":8900");

// Initialize computation definition (uses Anchor since it's a one-time setup)
async function initCompDef(
  program: Program<OpportunityMarket>,
  provider: anchor.AnchorProvider,
  owner: anchor.web3.Keypair,
  circuitName: string
): Promise<void> {
  const baseSeedCompDefAcc = getArciumAccountBaseSeed("ComputationDefinitionAccount");
  const offset = getCompDefAccOffset(circuitName);

  const compDefPDA = PublicKey.findProgramAddressSync(
    [baseSeedCompDefAcc, program.programId.toBuffer(), offset],
    getArciumProgramId()
  )[0];

  // Check if already exists
  const accountInfo = await provider.connection.getAccountInfo(compDefPDA);
  if (accountInfo !== null) {
    console.log(`   Comp def ${circuitName} already initialized, skipping...`);
    return;
  }

  // Initialize based on circuit name
  if (circuitName === "init_vote_token_account") {
    await program.methods
      .initVoteTokenAccountCompDef()
      .accounts({
        compDefAccount: compDefPDA,
        payer: owner.publicKey,
        mxeAccount: getMXEAccAddress(program.programId),
      })
      .signers([owner])
      .rpc({ preflightCommitment: "confirmed" });
  } else {
    throw new Error(`Unknown circuit: ${circuitName}`);
  }

  // Finalize
  const finalizeTx = await buildFinalizeCompDefTx(
    provider,
    Buffer.from(offset).readUInt32LE(),
    program.programId
  );
  const latestBlockhash = await provider.connection.getLatestBlockhash();
  finalizeTx.recentBlockhash = latestBlockhash.blockhash;
  finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
  finalizeTx.sign(owner);
  await provider.sendAndConfirm(finalizeTx);

  console.log(`   Comp def ${circuitName} initialized!`);
}

describe("OpportunityMarket (Kit)", () => {
  // Anchor setup for comp def initialization
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.OpportunityMarket as Program<OpportunityMarket>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  // RPC clients for Kit
  const rpc = createSolanaRpc(RPC_URL);
  const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
  const airdrop = airdropFactory({ rpc, rpcSubscriptions });

  let owner: anchor.web3.Keypair;

  before(async () => {
    // Load owner keypair
    const file = fs.readFileSync(`${os.homedir()}/.config/solana/id.json`);
    owner = anchor.web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(file.toString())));

    // Initialize computation definitions
    console.log("\n=== Initializing Computation Definitions ===\n");
    await initCompDef(program, provider, owner, "init_vote_token_account");
  });

  describe("Basic Operations", () => {
    it("can airdrop SOL to a new keypair", async () => {
      console.log("\n=== Kit Test: Airdrop SOL ===\n");

      // Generate a new keypair using Kit
      const buyer = await generateKeyPairSigner();
      console.log("   Generated buyer:", buyer.address);

      // Request airdrop
      const airdropAmount = lamports(2_000_000_000n); // 2 SOL
      console.log("   Requesting airdrop of 2 SOL...");

      await airdrop({
        recipientAddress: buyer.address,
        lamports: airdropAmount,
        commitment: "confirmed",
      });

      // Verify balance
      const balanceResult = await rpc.getBalance(buyer.address, { commitment: "confirmed" }).send();
      const balance = balanceResult.value;

      console.log("   Balance after airdrop:", Number(balance) / 1_000_000_000, "SOL");
      expect(Number(balance)).to.be.greaterThanOrEqual(2_000_000_000);

      console.log("\n   Airdrop test PASSED!");
    });

    it("can initialize a vote token account using Kit bindings", async () => {
      console.log("\n=== Kit Test: Initialize Vote Token Account ===\n");

      // Get Arcium environment
      const arciumEnv = getArciumEnv();

      // Generate a new keypair
      const buyer = await generateKeyPairSigner();
      console.log("   Generated buyer:", buyer.address);

      // Airdrop SOL for transaction fees
      const airdropAmount = lamports(2_000_000_000n);
      console.log("   Airdropping 2 SOL...");
      await airdrop({
        recipientAddress: buyer.address,
        lamports: airdropAmount,
        commitment: "confirmed",
      });

      // Generate computation offset and nonce
      const computationOffset = randomComputationOffset();
      const nonce = deserializeLE(randomBytes(16));

      // Generate a mock x25519 public key (32 bytes)
      const userPubkey = Array.from(randomBytes(32));

      console.log("   Computation offset:", computationOffset.toString());

      // Build the instruction using the simplified helper
      // All Arcium accounts are derived automatically
      const initVoteTokenAccountIx = await initVoteTokenAccount({
        signer: buyer,
        userPubkey,
        nonce,
        },
         {
          clusterOffset: arciumEnv.arciumClusterOffset,
          computationOffset,
        },
      );

      console.log("   Built initVoteTokenAccount instruction");

      // Get latest blockhash
      const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();

      // Build transaction message
      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (msg) => setTransactionMessageFeePayer(buyer.address, msg),
        (msg) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
        (msg) => appendTransactionMessageInstructions([initVoteTokenAccountIx], msg)
      );

      // Sign the transaction
      const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);

      // Simulate first to see any errors
      console.log("   Simulating transaction...");
      const base64Tx = getBase64EncodedWireTransaction(signedTransaction);
      const simResult = await rpc.simulateTransaction(base64Tx, {
        commitment: "confirmed",
        encoding: "base64",
      }).send();

      console.log("   Simulation result:");
      console.log("     Error:", simResult.value.err);
      console.log("     Logs:");
      simResult.value.logs?.forEach((log) => console.log("       ", log));

      if (simResult.value.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(simResult.value.err)}`);
      }

      console.log("   Sending transaction...");

      // Send and confirm using Anchor's provider for better error messages
      const txBytes = Buffer.from(base64Tx, "base64");
      const signature = await provider.connection.sendRawTransaction(txBytes, {
        skipPreflight: true,
      });
      await provider.connection.confirmTransaction(signature, "confirmed");

      console.log("   Transaction signature:", signature);
      console.log("\n   Vote token account initialization PASSED!");
    });
  });
});
