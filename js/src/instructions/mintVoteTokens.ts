import { Program, BN, type AnchorProvider } from "@coral-xyz/anchor";
import { SystemProgram, type PublicKey, Transaction } from "@solana/web3.js";
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
  deriveVoteTokenAccountPda,
  generateComputationOffset,
  ARCIUM_CLUSTER_OFFSET,
  getClusterAddress,
} from "../utils";
import type { X25519Keypair } from "../types";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for minting vote tokens
 */
export interface MintVoteTokensParams {
  /** User minting tokens (pays SOL) */
  signer: PublicKey;
  /** User's X25519 keypair for encryption */
  userX25519Keypair: X25519Keypair;
  /** Number of vote tokens to mint */
  amount: number | BN;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from building mint vote tokens transaction
 */
export interface MintVoteTokensResult {
  /** Transaction to sign and send */
  transaction: Transaction;
  /** PDA of the vote token account */
  voteTokenAccountPda: PublicKey;
  /** Computation offset (pass to awaitComputationFinalization) */
  computationOffset: BN;
}

/**
 * Builds a transaction to mint vote tokens by paying SOL
 *
 * Users buy vote tokens which can be used to purchase market shares.
 * Each token costs PRICE_PER_VOTE_TOKEN_LAMPORTS (0.001 SOL).
 * Uses MPC to update the encrypted balance.
 *
 * @param provider - Anchor provider for connection
 * @param params - Mint vote tokens parameters
 * @returns Transaction to sign and send, vote token account PDA, and computation offset
 */
export async function mintVoteTokens(
  provider: AnchorProvider,
  params: MintVoteTokensParams
): Promise<MintVoteTokensResult> {
  const programId = params.programId ?? PROGRAM_ID;
  const program = new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;

  const clusterAccount = getClusterAddress();

  // Derive vote token account PDA
  const [voteTokenAccountPda] = deriveVoteTokenAccountPda(
    params.signer,
    programId
  );

  // Auto-generate computation offset
  const computationOffset = generateComputationOffset();

  // Convert amount to BN
  const amountBN =
    typeof params.amount === "number" ? new BN(params.amount) : params.amount;

  const transaction = await program.methods
    .mintVoteTokens(
      computationOffset,
      Array.from(params.userX25519Keypair.publicKey),
      amountBN
    )
    .accountsPartial({
      signer: params.signer,
      voteTokenAccount: voteTokenAccountPda,
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
          getCompDefAccOffset(COMP_DEF_OFFSETS.BUY_VOTE_TOKENS)
        ).readUInt32LE()
      ),
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return {
    transaction,
    voteTokenAccountPda,
    computationOffset,
  };
}
