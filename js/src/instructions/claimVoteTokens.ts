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
  ARCIUM_CLUSTER_OFFSET,
  getClusterAddress,
} from "../utils";
import type { X25519Keypair } from "../types";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for claiming/selling vote tokens
 */
export interface ClaimVoteTokensParams {
  /** User claiming tokens (receives SOL) */
  signer: Keypair;
  /** User's X25519 keypair for encryption */
  userX25519Keypair: X25519Keypair;
  /** Number of vote tokens to sell */
  amount: number | BN;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from claiming vote tokens
 */
export interface ClaimVoteTokensResult {
  /** Transaction signature */
  signature: string;
  /** PDA of the vote token account */
  voteTokenAccountPda: PublicKey;
  /** Computation offset (pass to awaitComputationFinalization) */
  computationOffset: BN;
}

/**
 * Claims (sells) vote tokens for SOL
 *
 * Users can sell their unused vote tokens back for SOL.
 * Uses MPC to verify balance and deduct tokens.
 * Transfers SOL from the vote token account back to the user.
 *
 * @param provider - Anchor provider for connection and wallet
 * @param params - Claim vote tokens parameters
 * @returns Transaction signature, vote token account PDA, and await helper
 */
export async function claimVoteTokens(
  provider: AnchorProvider,
  params: ClaimVoteTokensParams
): Promise<ClaimVoteTokensResult> {
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

  // Auto-generate computation offset
  const computationOffset = generateComputationOffset();

  // Convert amount to BN
  const amountBN =
    typeof params.amount === "number" ? new BN(params.amount) : params.amount;

  const signature = await program.methods
    .claimVoteTokens(
      computationOffset,
      Array.from(params.userX25519Keypair.publicKey),
      amountBN
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
          getCompDefAccOffset(COMP_DEF_OFFSETS.CLAIM_VOTE_TOKENS)
        ).readUInt32LE()
      ),
      systemProgram: SystemProgram.programId,
    })
    .signers([params.signer])
    .rpc({ skipPreflight: true });

  return {
    signature,
    voteTokenAccountPda,
    computationOffset,
  };
}
