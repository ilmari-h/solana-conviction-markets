import {
  type Address,
  getAddressEncoder,
  getU64Encoder,
  getProgramDerivedAddress,
  type ProgramDerivedAddress,
} from "@solana/kit";
import { OPPORTUNITY_MARKET_PROGRAM_ADDRESS } from "../generated";

export const ENCRYPTED_TOKEN_ACCOUNT_SEED = "encrypted_token_account";

/**
 * Get the address for a regular EncryptedTokenAccount (index = 0).
 * Regular ETAs are created via init_encrypted_token_account.
 */
export async function getEncryptedTokenAccountAddress(
  tokenMint: Address,
  owner: Address,
  programId: Address = OPPORTUNITY_MARKET_PROGRAM_ADDRESS
): Promise<ProgramDerivedAddress> {
  return getEncryptedTokenAccountAddressWithIndex(tokenMint, owner, 0n, programId);
}

/**
 * Get the address for an EncryptedTokenAccount with a specific index.
 * Index 0 is the regular ETA, non-zero indices are ephemeral ETAs.
 */
export async function getEncryptedTokenAccountAddressWithIndex(
  tokenMint: Address,
  owner: Address,
  index: bigint,
  programId: Address = OPPORTUNITY_MARKET_PROGRAM_ADDRESS
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      ENCRYPTED_TOKEN_ACCOUNT_SEED,
      getAddressEncoder().encode(tokenMint),
      getAddressEncoder().encode(owner),
      getU64Encoder().encode(index),
    ],
  });
}

/**
 * Get the address for an ephemeral EncryptedTokenAccount.
 * Ephemeral ETAs use a non-zero index and are created via init_ephemeral_encrypted_token_account.
 */
export async function getEphemeralEncryptedTokenAccountAddress(
  tokenMint: Address,
  owner: Address,
  index: bigint,
  programId: Address = OPPORTUNITY_MARKET_PROGRAM_ADDRESS
): Promise<ProgramDerivedAddress> {
  return getEncryptedTokenAccountAddressWithIndex(tokenMint, owner, index, programId);
}
