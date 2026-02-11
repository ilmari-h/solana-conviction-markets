import {
  getArciumEnv,
  getMXEPublicKey,
  deserializeLE,
} from "@arcium-hq/client";
import {
  KeyPairSigner,
  Address,
  generateKeyPairSigner,
  airdropFactory,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  lamports,
  sendAndConfirmTransactionFactory,
  getProgramDerivedAddress,
  getBytesEncoder,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";
import {
  getTransferInstruction,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  createMarket,
  fetchOpportunityMarket,
  fetchMaybeCentralState,
  randomComputationOffset,
  getInitCentralStateInstructionAsync,
  initVoteTokenAccount,
  mintVoteTokens,
  addMarketOption,
  initShareAccount,
  stake,
  selectOption,
  revealShares,
  incrementOptionTally,
  closeShareAccount,
  openMarket as openMarketIx,
  awaitComputationFinalization,
  awaitBatchComputationFinalization,
  getVoteTokenAccountAddress,
  getShareAccountAddress as getShareAccountAddressPda,
  fetchShareAccount,
  getOpportunityMarketOptionAddress,
  fetchOpportunityMarketOption,
} from "../../js/src";
import { randomBytes } from "crypto";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { generateX25519Keypair, X25519Keypair, createCipher } from "../../js/src/x25519/keypair";
import { createTokenMint, createAta, mintTokensTo } from "./spl-token";
import { sendTransaction, type SendAndConfirmFn } from "./transaction";

// ============================================================================
// Types
// ============================================================================

export interface ShareAccountInfo {
  id: number;
  amount: bigint;
  optionIndex: number;
}

interface TestUser {
  solanaKeypair: KeyPairSigner;
  x25519Keypair: X25519Keypair;
  tokenAccount: Address;
  voteTokenAccount?: Address;
  shareAccounts: ShareAccountInfo[];
}

interface MarketConfig {
  maxShares: bigint;
  rewardAmount: bigint;
  timeToStake: bigint;
  timeToReveal: bigint;
}

export interface TestRunnerConfig {
  rpcUrl?: string;
  wsUrl?: string;
  numParticipants?: number;
  airdropLamports?: bigint;
  initialTokenAmount?: bigint;
  marketConfig?: Partial<MarketConfig>;
}

// Batch input types
export interface SharePurchase {
  userId: Address;
  amount: bigint;
  optionIndex: number;
}

export interface RevealRequest {
  userId: Address;
  shareAccountId: number;
}

export interface TallyIncrement {
  userId: Address;
  optionIndex: number;
  shareAccountId: number;
}

export interface CloseRequest {
  userId: Address;
  optionIndex: number;
  shareAccountId: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<TestRunnerConfig> = {
  rpcUrl: "http://127.0.0.1:8899",
  wsUrl: "ws://127.0.0.1:8900",
  numParticipants: 2,
  airdropLamports: 2_000_000_000n, // 2 SOL
  initialTokenAmount: 1_000_000_000n, // 1 billion tokens per account
  marketConfig: {
    maxShares: 1000n,
    rewardAmount: 1_000_000_000n,
    timeToStake: 120n, // 2 minutes
    timeToReveal: 60n, // 1 minute
  },
};

// ============================================================================
// Helper: getMXEPublicKeyWithRetry (kept as-is per requirements)
// ============================================================================

async function getMXEPublicKeyWithRetry(
  provider: anchor.AnchorProvider,
  programId: anchor.web3.PublicKey,
  maxRetries: number = 20,
  retryDelayMs: number = 500
): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const mxePublicKey = await getMXEPublicKey(provider, programId);
      if (mxePublicKey) {
        return mxePublicKey;
      }
    } catch (error) {
      console.log(`Attempt ${attempt} failed to fetch MXE public key:`, error);
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(`Failed to fetch MXE public key after ${maxRetries} attempts`);
}

// ============================================================================
// TestRunner Class
// ============================================================================

export class TestRunner {
  // Infrastructure
  private rpc: Rpc<SolanaRpcApi>;
  private rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
  private sendAndConfirm: SendAndConfirmFn;

  // Arcium
  private arciumEnv: ReturnType<typeof getArciumEnv>;
  private mxePublicKey: Uint8Array;
  private programId: Address;

  // Market
  private mint: KeyPairSigner;
  private marketAddress: Address;
  private marketCreator: TestUser;
  private marketConfig: MarketConfig;
  private optionCount: number;
  private openTimestamp: bigint | null = null;

  // Users: Map<address string, TestUser>
  private users: Map<string, TestUser>;

  private constructor() {
    // Private constructor - use static initialize()
    this.users = new Map();
    this.optionCount = 0;
  }

  // ============================================================================
  // Static Initializer
  // ============================================================================

  static async initialize(
    provider: anchor.AnchorProvider,
    programId: Address,
    config: TestRunnerConfig = {}
  ): Promise<TestRunner> {
    const runner = new TestRunner();

    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      marketConfig: { ...DEFAULT_CONFIG.marketConfig, ...config.marketConfig },
    };

    const { rpcUrl, wsUrl, numParticipants, airdropLamports, initialTokenAmount, marketConfig } = mergedConfig;

    // Store config
    runner.marketConfig = marketConfig as MarketConfig;
    runner.programId = programId;
    runner.arciumEnv = getArciumEnv();

    // Initialize RPC clients
    runner.rpc = createSolanaRpc(rpcUrl) as unknown as Rpc<SolanaRpcApi>;
    runner.rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);
    // Cast to any for airdropFactory since it has complex cluster-based typing
    const airdrop = airdropFactory({ rpc: runner.rpc, rpcSubscriptions: runner.rpcSubscriptions } as any);
    runner.sendAndConfirm = sendAndConfirmTransactionFactory({
      rpc: runner.rpc,
      rpcSubscriptions: runner.rpcSubscriptions,
    });

    // Fetch MXE public key (requires web3.js PublicKey for @arcium-hq/client)
    const programIdLegacy = new PublicKey(programId);
    runner.mxePublicKey = await getMXEPublicKeyWithRetry(provider, programIdLegacy);

    // Create all accounts (participants + market creator)
    console.log(`\nCreating ${numParticipants + 1} accounts...`);
    const accountPromises = Array.from({ length: numParticipants + 1 }, async () => {
      const keypair = await generateKeyPairSigner();
      const x25519Keypair = generateX25519Keypair();
      return { keypair, x25519Keypair };
    });
    const accounts = await Promise.all(accountPromises);

    // Split into participants and creator
    const participantAccounts = accounts.slice(0, numParticipants);
    const creatorAccountBase = accounts[numParticipants];

    // Airdrop to all accounts in parallel
    console.log(`Airdropping ${Number(airdropLamports) / 1_000_000_000} SOL to all accounts...`);
    const airdropPromises = accounts.map((account) =>
      airdrop({
        recipientAddress: account.keypair.address,
        lamports: lamports(airdropLamports),
        commitment: "confirmed",
      })
    );
    await Promise.all(airdropPromises);

    // Create SPL token mint (creator is mint authority)
    console.log("Creating SPL token mint...");
    runner.mint = await createTokenMint(
      runner.rpc,
      runner.sendAndConfirm,
      creatorAccountBase.keypair,
      creatorAccountBase.keypair.address
    );
    console.log(`  Mint created: ${runner.mint.address}`);

    // Create ATAs and mint tokens for all accounts
    console.log("Creating ATAs and minting tokens...");
    const accountsWithTokens: Array<{
      keypair: KeyPairSigner;
      x25519Keypair: X25519Keypair;
      tokenAccount: Address;
    }> = [];

    for (const account of accounts) {
      const ata = await createAta(
        runner.rpc,
        runner.sendAndConfirm,
        creatorAccountBase.keypair,
        runner.mint.address,
        account.keypair.address
      );
      await mintTokensTo(
        runner.rpc,
        runner.sendAndConfirm,
        creatorAccountBase.keypair,
        runner.mint.address,
        ata,
        initialTokenAmount
      );
      accountsWithTokens.push({
        keypair: account.keypair,
        x25519Keypair: account.x25519Keypair,
        tokenAccount: ata,
      });
    }

    // Build TestUser objects and populate the map
    for (let i = 0; i < numParticipants; i++) {
      const acc = accountsWithTokens[i];
      const user: TestUser = {
        solanaKeypair: acc.keypair,
        x25519Keypair: acc.x25519Keypair,
        tokenAccount: acc.tokenAccount,
        shareAccounts: [],
      };
      runner.users.set(acc.keypair.address.toString(), user);
    }

    // Market creator
    const creatorAcc = accountsWithTokens[numParticipants];
    runner.marketCreator = {
      solanaKeypair: creatorAcc.keypair,
      x25519Keypair: creatorAcc.x25519Keypair,
      tokenAccount: creatorAcc.tokenAccount,
      shareAccounts: [],
    };
    // Also add creator to users map so they can be looked up
    runner.users.set(creatorAcc.keypair.address.toString(), runner.marketCreator);

    // Initialize central state (skip if already exists)
    const [centralStateAddress] = await getProgramDerivedAddress({
      programAddress: programId,
      seeds: [getBytesEncoder().encode(new Uint8Array([99, 101, 110, 116, 114, 97, 108, 95, 115, 116, 97, 116, 101]))], // "central_state"
    });
    const centralStateAccount = await fetchMaybeCentralState(runner.rpc, centralStateAddress);

    if (!centralStateAccount.exists) {
      console.log("Initializing central state...");
      const initCentralStateIx = await getInitCentralStateInstructionAsync({
        payer: runner.marketCreator.solanaKeypair,
        earlinessCutoffSeconds: 0n,
        minOptionDeposit: 1n,
      });

      await sendTransaction(runner.rpc, runner.sendAndConfirm, runner.marketCreator.solanaKeypair, [initCentralStateIx], {
        label: "Init central state",
      });
    } else {
      console.log("Central state already exists, skipping initialization...");
    }

    // Create the market
    console.log("Creating market...");
    const marketIndex = BigInt(Math.floor(Math.random() * 1000000));
    const nonce = deserializeLE(randomBytes(16));
    const computationOffset = randomComputationOffset();

    const createMarketIx = await createMarket(
      {
        creator: runner.marketCreator.solanaKeypair,
        tokenMint: runner.mint.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        marketIndex,
        maxShares: marketConfig.maxShares,
        rewardAmount: marketConfig.rewardAmount,
        timeToStake: marketConfig.timeToStake,
        timeToReveal: marketConfig.timeToReveal,
        marketAuthority: null,
        nonce,
      },
      {
        clusterOffset: runner.arciumEnv.arciumClusterOffset,
        computationOffset,
        programId,
      }
    );

    await sendTransaction(runner.rpc, runner.sendAndConfirm, runner.marketCreator.solanaKeypair, [createMarketIx], {
      label: "Create market",
    });

    // Get market address from the instruction accounts
    runner.marketAddress = createMarketIx.accounts[3].address as Address;
    console.log(`  Market created: ${runner.marketAddress}`);

    return runner;
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  get participants(): Address[] {
    return Array.from(this.users.keys())
      .filter((k) => k !== this.marketCreator.solanaKeypair.address.toString())
      .map((k) => this.users.get(k)!.solanaKeypair.address);
  }

  get creator(): Address {
    return this.marketCreator.solanaKeypair.address;
  }

  get market(): Address {
    return this.marketAddress;
  }

  get mintAddress(): Address {
    return this.mint.address;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getUser(userId: Address): TestUser {
    const user = this.users.get(userId.toString());
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    return user;
  }

  private getArciumConfig(computationOffset: bigint) {
    return {
      clusterOffset: this.arciumEnv.arciumClusterOffset,
      computationOffset,
      programId: this.programId,
    };
  }

  private getNextShareAccountId(user: TestUser): number {
    return user.shareAccounts.length;
  }

  private addShareAccount(user: TestUser, info: ShareAccountInfo): void {
    user.shareAccounts.push(info);
  }

  private assertVtaInitialized(user: TestUser): void {
    if (!user.voteTokenAccount) {
      throw new Error(
        `VTA not initialized for user ${user.solanaKeypair.address}. Call initVoteTokenAccount first.`
      );
    }
  }

  // ============================================================================
  // Market Operations
  // ============================================================================

  async fundMarket(amount?: bigint): Promise<void> {
    const fundingAmount = amount ?? this.marketConfig.rewardAmount;

    const [marketAta] = await findAssociatedTokenPda({
      mint: this.mint.address,
      owner: this.marketAddress,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    const ix = getTransferInstruction({
      source: this.marketCreator.tokenAccount,
      destination: marketAta,
      authority: this.marketCreator.solanaKeypair,
      amount: fundingAmount,
    });

    await sendTransaction(this.rpc, this.sendAndConfirm, this.marketCreator.solanaKeypair, [ix], {
      label: "Fund market",
    });
  }

  async openMarket(openTimestampArg?: bigint): Promise<bigint> {
    const timestamp = openTimestampArg ?? BigInt(Math.floor(Date.now() / 1000) + 6);

    const [marketAta] = await findAssociatedTokenPda({
      mint: this.mint.address,
      owner: this.marketAddress,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    const ix = openMarketIx({
      creator: this.marketCreator.solanaKeypair,
      market: this.marketAddress,
      tokenMint: this.mint.address,
      marketTokenAta: marketAta,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      openTimestamp: timestamp,
    });

    await sendTransaction(this.rpc, this.sendAndConfirm, this.marketCreator.solanaKeypair, [ix], {
      label: "Open market",
    });

    this.openTimestamp = timestamp;
    return timestamp;
  }

  async selectOption(optionIndex: number): Promise<void> {
    const ix = selectOption({
      authority: this.marketCreator.solanaKeypair,
      market: this.marketAddress,
      optionIndex,
    });

    await sendTransaction(this.rpc, this.sendAndConfirm, this.marketCreator.solanaKeypair, [ix], {
      label: "Select option",
    });
  }

  // ============================================================================
  // VTA Operations
  // ============================================================================

  async initVoteTokenAccount(userId: Address): Promise<Address> {
    const user = this.getUser(userId);
    const offset = randomComputationOffset();
    const nonce = deserializeLE(randomBytes(16));

    const ix = await initVoteTokenAccount(
      {
        signer: user.solanaKeypair,
        tokenMint: this.mint.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        userPubkey: user.x25519Keypair.publicKey,
        nonce,
      },
      this.getArciumConfig(offset)
    );

    await sendTransaction(this.rpc, this.sendAndConfirm, user.solanaKeypair, [ix], {
      label: `Init VTA for ${userId.toString().slice(0, 8)}...`,
    });

    await awaitComputationFinalization(this.rpc, offset);

    const [vtaAddress] = await getVoteTokenAccountAddress(this.mint.address, userId);
    user.voteTokenAccount = vtaAddress;
    return vtaAddress;
  }

  async mintVoteTokens(userId: Address, amount: bigint): Promise<void> {
    const user = this.getUser(userId);
    this.assertVtaInitialized(user);
    const offset = randomComputationOffset();

    const ix = await mintVoteTokens(
      {
        signer: user.solanaKeypair,
        tokenMint: this.mint.address,
        signerTokenAccount: user.tokenAccount,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        userPubkey: user.x25519Keypair.publicKey,
        amount,
      },
      this.getArciumConfig(offset)
    );

    await sendTransaction(this.rpc, this.sendAndConfirm, user.solanaKeypair, [ix], {
      label: `Mint ${amount} vote tokens`,
    });

    await awaitComputationFinalization(this.rpc, offset);
  }

  // ============================================================================
  // Option Management
  // ============================================================================

  async addMarketOption(
    userId: Address,
    name: string,
    depositAmount: bigint
  ): Promise<{ optionIndex: number; shareAccountId: number }> {
    const user = this.getUser(userId);
    this.assertVtaInitialized(user);

    const cipher = createCipher(user.x25519Keypair.secretKey, this.mxePublicKey);
    const optionIndex = ++this.optionCount;
    const shareAccountId = this.getNextShareAccountId(user);

    const inputNonce = randomBytes(16);
    const amountCiphertext = cipher.encrypt([depositAmount], inputNonce);
    const offset = randomComputationOffset();

    const ix = await addMarketOption(
      {
        creator: user.solanaKeypair,
        market: this.marketAddress,
        sourceVta: user.voteTokenAccount!,
        optionIndex,
        shareAccountId,
        name,
        amountCiphertext: amountCiphertext[0],
        userPubkey: user.x25519Keypair.publicKey,
        inputNonce: deserializeLE(inputNonce),
        authorizedReaderPubkey: user.x25519Keypair.publicKey,
        authorizedReaderNonce: deserializeLE(randomBytes(16)),
        shareAccountNonce: deserializeLE(randomBytes(16)),
      },
      this.getArciumConfig(offset)
    );

    await sendTransaction(this.rpc, this.sendAndConfirm, user.solanaKeypair, [ix], {
      label: `Add option "${name}"`,
    });

    await awaitComputationFinalization(this.rpc, offset);

    // Store share account info
    this.addShareAccount(user, { id: shareAccountId, amount: depositAmount, optionIndex });

    return { optionIndex, shareAccountId };
  }

  // ============================================================================
  // Share Operations - Batch First
  // ============================================================================

  async buySharesBatch(purchases: SharePurchase[]): Promise<number[]> {
    // Pre-allocate share account IDs to avoid conflicts when same user has multiple purchases
    const userShareAccountOffsets = new Map<string, number>();
    const preAllocatedIds = purchases.map((p) => {
      const userKey = p.userId.toString();
      const user = this.getUser(p.userId);
      const baseId = this.getNextShareAccountId(user);
      const offset = userShareAccountOffsets.get(userKey) ?? 0;
      userShareAccountOffsets.set(userKey, offset + 1);
      return baseId + offset;
    });

    // Build all instruction data in parallel
    const purchaseData = await Promise.all(
      purchases.map(async (p, idx) => {
        const user = this.getUser(p.userId);
        this.assertVtaInitialized(user);

        const cipher = createCipher(user.x25519Keypair.secretKey, this.mxePublicKey);
        const shareAccountId = preAllocatedIds[idx];

        // Init share account instruction
        const initIx = await initShareAccount({
          signer: user.solanaKeypair,
          market: this.marketAddress,
          stateNonce: deserializeLE(randomBytes(16)),
          shareAccountId,
        });

        // Stake instruction
        const inputNonce = randomBytes(16);
        const ciphertexts = cipher.encrypt([p.amount, BigInt(p.optionIndex)], inputNonce);
        const computationOffset = randomComputationOffset();

        const [userVta] = await getVoteTokenAccountAddress(this.mint.address, p.userId);

        const stakeIx = await stake(
          {
            signer: user.solanaKeypair,
            market: this.marketAddress,
            userVta,
            shareAccountId,
            amountCiphertext: ciphertexts[0],
            selectedOptionCiphertext: ciphertexts[1],
            userPubkey: user.x25519Keypair.publicKey,
            inputNonce: deserializeLE(inputNonce),
            authorizedReaderPubkey: user.x25519Keypair.publicKey,
            authorizedReaderNonce: deserializeLE(randomBytes(16)),
          },
          this.getArciumConfig(computationOffset)
        );

        return { user, initIx, stakeIx, computationOffset, shareAccountId, amount: p.amount, optionIndex: p.optionIndex };
      })
    );

    // Send init share account transactions sequentially
    for (const data of purchaseData) {
      await sendTransaction(this.rpc, this.sendAndConfirm, data.user.solanaKeypair, [data.initIx], {
        label: `Init share account`,
      });
    }

    // Send stake transactions sequentially
    for (const data of purchaseData) {
      await sendTransaction(this.rpc, this.sendAndConfirm, data.user.solanaKeypair, [data.stakeIx], {
        label: `Buy shares`,
      });
    }

    // Await all computations in batch
    await awaitBatchComputationFinalization(
      this.rpc,
      purchaseData.map((d) => d.computationOffset)
    );

    // Store share account info for each user
    for (const data of purchaseData) {
      this.addShareAccount(data.user, {
        id: data.shareAccountId,
        amount: data.amount,
        optionIndex: data.optionIndex,
      });
    }

    return purchaseData.map((d) => d.shareAccountId);
  }

  async buyShares(userId: Address, amount: bigint, optionIndex: number): Promise<number> {
    const [shareAccountId] = await this.buySharesBatch([{ userId, amount, optionIndex }]);
    return shareAccountId;
  }

  async revealSharesBatch(reveals: RevealRequest[]): Promise<void> {
    const revealData = await Promise.all(
      reveals.map(async (r) => {
        const user = this.getUser(r.userId);
        const computationOffset = randomComputationOffset();
        const [userVta] = await getVoteTokenAccountAddress(this.mint.address, r.userId);

        const ix = await revealShares(
          {
            signer: user.solanaKeypair,
            owner: user.solanaKeypair.address,
            market: this.marketAddress,
            userVta,
            userPubkey: user.x25519Keypair.publicKey,
            shareAccountId: r.shareAccountId,
          },
          this.getArciumConfig(computationOffset)
        );

        return { user, ix, computationOffset };
      })
    );

    // Send sequentially
    for (const data of revealData) {
      await sendTransaction(this.rpc, this.sendAndConfirm, data.user.solanaKeypair, [data.ix], {
        label: `Reveal shares`,
      });
    }

    // Await all computations
    await awaitBatchComputationFinalization(
      this.rpc,
      revealData.map((d) => d.computationOffset)
    );
  }

  async revealShares(userId: Address, shareAccountId: number): Promise<void> {
    await this.revealSharesBatch([{ userId, shareAccountId }]);
  }

  async incrementOptionTallyBatch(increments: TallyIncrement[]): Promise<void> {
    const instructions = await Promise.all(
      increments.map(async (inc) => {
        const user = this.getUser(inc.userId);
        const ix = await incrementOptionTally({
          signer: user.solanaKeypair,
          owner: user.solanaKeypair.address,
          market: this.marketAddress,
          optionIndex: inc.optionIndex,
          shareAccountId: inc.shareAccountId,
        });
        return { user, ix };
      })
    );

    for (const data of instructions) {
      await sendTransaction(this.rpc, this.sendAndConfirm, data.user.solanaKeypair, [data.ix], {
        label: `Increment tally`,
      });
    }
  }

  async incrementOptionTally(userId: Address, optionIndex: number, shareAccountId: number): Promise<void> {
    await this.incrementOptionTallyBatch([{ userId, optionIndex, shareAccountId }]);
  }

  async closeShareAccountBatch(closes: CloseRequest[]): Promise<void> {
    const instructions = await Promise.all(
      closes.map(async (close) => {
        const user = this.getUser(close.userId);
        const ix = await closeShareAccount({
          owner: user.solanaKeypair,
          market: this.marketAddress,
          tokenMint: this.mint.address,
          ownerTokenAccount: user.tokenAccount,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
          optionIndex: close.optionIndex,
          shareAccountId: close.shareAccountId,
        });
        return { user, ix };
      })
    );

    for (const data of instructions) {
      await sendTransaction(this.rpc, this.sendAndConfirm, data.user.solanaKeypair, [data.ix], {
        label: `Close share account`,
      });
    }
  }

  async closeShareAccount(userId: Address, optionIndex: number, shareAccountId: number): Promise<void> {
    await this.closeShareAccountBatch([{ userId, optionIndex, shareAccountId }]);
  }

  // ============================================================================
  // Utility Methods for Tests
  // ============================================================================

  /** Get the RPC client for assertions */
  getRpc(): Rpc<SolanaRpcApi> {
    return this.rpc;
  }

  /** Fetch the market account */
  async fetchMarket() {
    return fetchOpportunityMarket(this.rpc, this.marketAddress);
  }

  /** Get the MXE public key for encryption */
  getMxePublicKey(): Uint8Array {
    return this.mxePublicKey;
  }

  /** Get a user's x25519 keypair for encryption operations in tests */
  getUserX25519Keypair(userId: Address): X25519Keypair {
    return this.getUser(userId).x25519Keypair;
  }

  /** Get a user's token account address */
  getUserTokenAccount(userId: Address): Address {
    return this.getUser(userId).tokenAccount;
  }

  /** Get a user's share accounts info (id, amount, optionIndex for each) */
  getUserShareAccounts(userId: Address): ShareAccountInfo[] {
    return this.getUser(userId).shareAccounts;
  }

  /** Get share accounts for a user filtered by option index */
  getUserShareAccountsForOption(userId: Address, optionIndex: number): ShareAccountInfo[] {
    return this.getUser(userId).shareAccounts.filter((sa) => sa.optionIndex === optionIndex);
  }

  /** Get the open timestamp (set after openMarket is called) */
  getOpenTimestamp(): bigint {
    if (this.openTimestamp === null) {
      throw new Error("Market not opened yet. Call openMarket() first.");
    }
    return this.openTimestamp;
  }

  /** Get timeToStake from market config */
  getTimeToStake(): bigint {
    return this.marketConfig.timeToStake;
  }

  /** Get timeToReveal from market config */
  getTimeToReveal(): bigint {
    return this.marketConfig.timeToReveal;
  }

  /** Get rewardAmount from market config */
  getRewardAmount(): bigint {
    return this.marketConfig.rewardAmount;
  }

  /** Get market's token ATA address */
  async getMarketAta(): Promise<Address> {
    const [marketAta] = await findAssociatedTokenPda({
      mint: this.mint.address,
      owner: this.marketAddress,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    return marketAta;
  }

  /** Get share account PDA address for a user */
  async getShareAccountAddress(userId: Address, shareAccountId: number): Promise<Address> {
    const [address] = await getShareAccountAddressPda(userId, this.marketAddress, shareAccountId);
    return address;
  }

  /** Fetch a share account */
  async fetchShareAccountData(userId: Address, shareAccountId: number) {
    const address = await this.getShareAccountAddress(userId, shareAccountId);
    return fetchShareAccount(this.rpc, address);
  }

  /** Get option PDA address */
  async getOptionAddress(optionIndex: number): Promise<Address> {
    const [address] = await getOpportunityMarketOptionAddress(this.marketAddress, optionIndex);
    return address;
  }

  /** Fetch an option account */
  async fetchOptionData(optionIndex: number) {
    const address = await this.getOptionAddress(optionIndex);
    return fetchOpportunityMarketOption(this.rpc, address);
  }

  /** Check if an account exists (for verifying closure) */
  async accountExists(address: Address): Promise<boolean> {
    const info = await this.rpc.getAccountInfo(address).send();
    return info.value !== null;
  }
}
