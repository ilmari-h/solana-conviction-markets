import {
  type Address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type ProgramDerivedAddress,
} from "@solana/kit";
import { OPPORTUNITY_MARKET_PROGRAM_ADDRESS } from "../generated";

export const VOTE_TOKEN_ACCOUNT_SEED = "vote_token_account";

export async function getVoteTokenAccountAddress(
  tokenMint: Address,
  owner: Address,
  programId: Address = OPPORTUNITY_MARKET_PROGRAM_ADDRESS
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      VOTE_TOKEN_ACCOUNT_SEED,
      getAddressEncoder().encode(tokenMint),
      getAddressEncoder().encode(owner),
    ],
  });
}

export async function getLockedVoteTokenAccountAddress(
  tokenMint: Address,
  owner: Address,
  market: Address,
  optionIndex: number,
  programId: Address = OPPORTUNITY_MARKET_PROGRAM_ADDRESS
): Promise<ProgramDerivedAddress> {
  const optionIndexBytes = new Uint8Array(2);
  optionIndexBytes[0] = optionIndex & 0xff;
  optionIndexBytes[1] = (optionIndex >> 8) & 0xff;

  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      VOTE_TOKEN_ACCOUNT_SEED,
      getAddressEncoder().encode(tokenMint),
      getAddressEncoder().encode(owner),
      getAddressEncoder().encode(market),
      optionIndexBytes,
    ],
  });
}
