import { Program, BN, type AnchorProvider } from "@coral-xyz/anchor";
import type { PublicKey, Transaction } from "@solana/web3.js";
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
  deriveShareAccountPda,
  generateComputationOffset,
  ARCIUM_CLUSTER_OFFSET,
  getClusterAddress,
} from "../utils";
import type { X25519Keypair } from "../types";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for revealing shares
 */
export interface RevealSharesParams {
  /** User calling the reveal (can be anyone) */
  signer: PublicKey;
  /** Owner of the share account to reveal */
  owner: PublicKey;
  /** Market PDA */
  market: PublicKey;
  /** Owner's X25519 keypair for encryption */
  ownerX25519Keypair: X25519Keypair;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from building reveal shares transaction
 */
export interface RevealSharesResult {
  /** Transaction to sign and send */
  transaction: Transaction;
  /** PDA of the share account */
  shareAccountPda: PublicKey;
  /** Computation offset (pass to awaitComputationFinalization) */
  computationOffset: BN;
}

/**
 * Builds a transaction to reveal a user's encrypted shares after staking ends
 *
 * Permissionless - anyone can reveal anyone's shares after the staking
 * period ends and the winning option is selected.
 * Updates share account with revealed amount/option and credits vote
 * token balance back to the user.
 *
 * @param provider - Anchor provider for connection
 * @param params - Reveal shares parameters
 * @returns Transaction to sign and send, share account PDA, and computation offset
 */
export async function revealShares(
  provider: AnchorProvider,
  params: RevealSharesParams
): Promise<RevealSharesResult> {
  const programId = params.programId ?? PROGRAM_ID;
  const program = new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;

  const clusterAccount = getClusterAddress();

  // Derive accounts
  const [voteTokenAccountPda] = deriveVoteTokenAccountPda(
    params.owner,
    programId
  );
  const [shareAccountPda] = deriveShareAccountPda(
    params.owner,
    params.market,
    programId
  );

  // Auto-generate computation offset
  const computationOffset = generateComputationOffset();

  const transaction = await program.methods
    .revealShares(
      computationOffset,
      Array.from(params.ownerX25519Keypair.publicKey)
    )
    .accountsPartial({
      owner: params.owner,
      market: params.market,
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
          getCompDefAccOffset(COMP_DEF_OFFSETS.REVEAL_SHARES)
        ).readUInt32LE()
      ),
    })
    .transaction();

  return {
    transaction,
    shareAccountPda,
    computationOffset,
  };
}
