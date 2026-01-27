import { Program, type AnchorProvider } from "@coral-xyz/anchor";
import { SystemProgram, type Keypair, type PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "../constants";
import { deriveShareAccountPda, generateNonce, nonceToU128 } from "../utils";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for initializing a share account
 */
export interface InitShareAccountParams {
  /** User creating the share account */
  signer: Keypair;
  /** Market PDA to create share account for */
  market: PublicKey;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from initializing a share account
 */
export interface InitShareAccountResult {
  /** Transaction signature */
  signature: string;
  /** PDA of the created share account */
  shareAccountPda: PublicKey;
}

/**
 * Initializes a share account for a user in a specific market
 *
 * This must be called before buying shares. The share account will
 * store the user's encrypted position (shares + selected option).
 *
 * @param provider - Anchor provider for connection and wallet
 * @param params - Init share account parameters
 * @returns Transaction signature and share account PDA
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
    params.signer.publicKey,
    params.market,
    programId
  );

  // Generate random nonce for encrypted state
  const nonce = generateNonce();
  const nonceBN = nonceToU128(nonce);

  const signature = await program.methods
    .initShareAccount(nonceBN)
    .accountsPartial({
      market: params.market,
      systemProgram: SystemProgram.programId,
    })
    .signers([params.signer])
    .rpc();

  return { signature, shareAccountPda };
}
