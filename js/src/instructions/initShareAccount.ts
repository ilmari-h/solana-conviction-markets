import { Program, type AnchorProvider } from "@coral-xyz/anchor";
import { SystemProgram, type PublicKey, Transaction } from "@solana/web3.js";
import { PROGRAM_ID } from "../constants";
import { deriveShareAccountPda, generateNonce, nonceToU128 } from "../utils";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for initializing a share account
 */
export interface InitShareAccountParams {
  /** User creating the share account */
  signer: PublicKey;
  /** Market PDA to create share account for */
  market: PublicKey;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from building init share account transaction
 */
export interface InitShareAccountResult {
  /** Transaction to sign and send */
  transaction: Transaction;
  /** PDA of the created share account */
  shareAccountPda: PublicKey;
}

/**
 * Builds a transaction to initialize a share account for a user in a specific market
 *
 * This must be called before buying shares. The share account will
 * store the user's encrypted position (shares + selected option).
 *
 * @param provider - Anchor provider for connection
 * @param params - Init share account parameters
 * @returns Transaction to sign and send, and share account PDA
 */
export async function initShareAccount(
  provider: AnchorProvider,
  params: InitShareAccountParams
): Promise<InitShareAccountResult> {
  const programId = params.programId ?? PROGRAM_ID;
  const program = new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;

  const [shareAccountPda] = deriveShareAccountPda(
    params.signer,
    params.market,
    programId
  );

  // Generate random nonce for encrypted state
  const nonce = generateNonce();
  const nonceBN = nonceToU128(nonce);

  const transaction = await program.methods
    .initShareAccount(nonceBN)
    .accountsPartial({
      market: params.market,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return { transaction, shareAccountPda };
}
