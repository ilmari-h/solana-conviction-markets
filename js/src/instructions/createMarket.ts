import { Program, BN, type AnchorProvider } from "@coral-xyz/anchor";
import { SystemProgram, type Keypair, type PublicKey } from "@solana/web3.js";
import {
  getCompDefAccOffset,
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getCompDefAccAddress,
} from "@arcium-hq/client";
import { PROGRAM_ID, COMP_DEF_OFFSETS } from "../constants";
import {
  deriveMarketPda,
  generateComputationOffset,
  generateNonce,
  nonceToU128,
  ARCIUM_CLUSTER_OFFSET,
  getClusterAddress,
} from "../utils";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for creating a market
 */
export interface CreateMarketParams {
  /** Market creator (pays for account creation) */
  creator: Keypair;
  /** Unique market index */
  marketIndex: number | BN;
  /** Maximum number of options allowed */
  maxOptions: number;
  /** Maximum shares available for purchase */
  maxShares: number | BN;
  /** Reward pool in lamports for winners */
  rewardLamports: number | BN;
  /** Duration of staking period in seconds */
  timeToStake: number | BN;
  /** Duration of reveal period in seconds */
  timeToReveal: number | BN;
  /** Optional authority that can select winning option */
  selectAuthority?: PublicKey;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from creating a market
 */
export interface CreateMarketResult {
  /** Transaction signature */
  signature: string;
  /** PDA of the created market */
  marketPda: PublicKey;
  /** Computation offset (pass to awaitComputationFinalization) */
  computationOffset: BN;
}

/**
 * Creates a new conviction market with encrypted state
 *
 * Initializes a market with encrypted available shares via MPC computation.
 * After creation, options must be added and the market must be funded and opened.
 *
 * @param provider - Anchor provider for connection and wallet
 * @param params - Create market parameters
 * @returns Transaction signature, market PDA, and await helper
 */
export async function createMarket(
  provider: AnchorProvider,
  params: CreateMarketParams
): Promise<CreateMarketResult> {
  const programId = params.programId ?? PROGRAM_ID;
  const program = new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;

  const clusterAccount = getClusterAddress();

  // Convert parameters to BN
  const marketIndexBN =
    typeof params.marketIndex === "number"
      ? new BN(params.marketIndex)
      : params.marketIndex;
  const maxSharesBN =
    typeof params.maxShares === "number"
      ? new BN(params.maxShares)
      : params.maxShares;
  const rewardLamportsBN =
    typeof params.rewardLamports === "number"
      ? new BN(params.rewardLamports)
      : params.rewardLamports;
  const timeToStakeBN =
    typeof params.timeToStake === "number"
      ? new BN(params.timeToStake)
      : params.timeToStake;
  const timeToRevealBN =
    typeof params.timeToReveal === "number"
      ? new BN(params.timeToReveal)
      : params.timeToReveal;

  // Derive market PDA
  const [marketPda] = deriveMarketPda(
    params.creator.publicKey,
    marketIndexBN,
    programId
  );

  // Auto-generate computation offset and nonce
  const computationOffset = generateComputationOffset();
  const nonce = generateNonce();
  const nonceBN = nonceToU128(nonce);

  const signature = await program.methods
    .createMarket(
      marketIndexBN,
      computationOffset,
      params.maxOptions,
      maxSharesBN,
      rewardLamportsBN,
      timeToStakeBN,
      timeToRevealBN,
      nonceBN,
      params.selectAuthority ?? null
    )
    .accountsPartial({
      creator: params.creator.publicKey,
      market: marketPda,
      computationAccount: getComputationAccAddress(
        ARCIUM_CLUSTER_OFFSET,
        computationOffset
      ),
      clusterAccount,
      mxeAccount: getMXEAccAddress(programId),
      mempoolAccount: getMempoolAccAddress(ARCIUM_CLUSTER_OFFSET),
      executingPool: getExecutingPoolAccAddress(ARCIUM_CLUSTER_OFFSET),
      compDefAccount: getCompDefAccAddress(
        programId,
        Buffer.from(
          getCompDefAccOffset(COMP_DEF_OFFSETS.INIT_MARKET_SHARES)
        ).readUInt32LE()
      ),
      systemProgram: SystemProgram.programId,
    })
    .signers([params.creator])
    .rpc({ skipPreflight: true });

  return {
    signature,
    marketPda,
    computationOffset,
  };
}
