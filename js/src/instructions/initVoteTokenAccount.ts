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
  signer: Keypair;
  /** User's X25519 keypair for encryption */
  userX25519Keypair: X25519Keypair;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from initializing a vote token account
 */
export interface InitVoteTokenAccountResult {
  /** Transaction signature */
  signature: string;
  /** PDA of the created vote token account */
  voteTokenAccountPda: PublicKey;
  /** Computation offset (pass to awaitComputationFinalization) */
  computationOffset: BN;
}

/**
 * Initializes a vote token account via encrypted computation
 *
 * Sets up the encrypted balance state for a user. Must be called before
 * minting vote tokens.
 *
 * @param provider - Anchor provider for connection and wallet
 * @param params - Init vote token account parameters
 * @returns Transaction signature, vote token account PDA, and await helper
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
    params.signer.publicKey,
    programId
  );

  // Auto-generate computation offset and nonce
  const computationOffset = generateComputationOffset();
  const nonce = generateNonce();
  const nonceBN = nonceToU128(nonce);

  const signature = await program.methods
    .initVoteTokenAccount(
      computationOffset,
      Array.from(params.userX25519Keypair.publicKey),
      nonceBN
    )
    .accountsPartial({
      signer: params.signer.publicKey,
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
    .signers([params.signer])
    .rpc({ skipPreflight: false });

  return {
    signature,
    voteTokenAccountPda,
    computationOffset,
  };
}
