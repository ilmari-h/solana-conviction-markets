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
  generateNonce,
  nonceToU128,
  ARCIUM_CLUSTER_OFFSET,
  getClusterAddress,
} from "../utils";
import type { X25519Keypair } from "../types";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for initializing a vote token account
 */
export interface InitVoteTokenAccountParams {
  /** User creating the vote token account */
  signer: PublicKey;
  /** User's X25519 keypair for encryption */
  userX25519Keypair: X25519Keypair;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from building init vote token account transaction
 */
export interface InitVoteTokenAccountResult {
  /** Transaction to sign and send */
  transaction: Transaction;
  /** PDA of the created vote token account */
  voteTokenAccountPda: PublicKey;
  /** Computation offset (pass to awaitComputationFinalization) */
  computationOffset: BN;
}

/**
 * Builds a transaction to initialize a vote token account via encrypted computation
 *
 * Sets up the encrypted balance state for a user. Must be called before
 * minting vote tokens.
 *
 * @param provider - Anchor provider for connection
 * @param params - Init vote token account parameters
 * @returns Transaction to sign and send, vote token account PDA, and computation offset
 */
export async function initVoteTokenAccount(
  provider: AnchorProvider,
  params: InitVoteTokenAccountParams
): Promise<InitVoteTokenAccountResult> {
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

  // Auto-generate computation offset and nonce
  const computationOffset = generateComputationOffset();
  const nonce = generateNonce();
  const nonceBN = nonceToU128(nonce);

  const transaction = await program.methods
    .initVoteTokenAccount(
      computationOffset,
      Array.from(params.userX25519Keypair.publicKey),
      nonceBN
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
          getCompDefAccOffset(COMP_DEF_OFFSETS.INIT_VOTE_TOKEN_ACCOUNT)
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
