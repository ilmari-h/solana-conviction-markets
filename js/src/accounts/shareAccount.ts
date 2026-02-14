import {
  type Address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type ProgramDerivedAddress,
} from "@solana/kit";
import { OPPORTUNITY_MARKET_PROGRAM_ADDRESS } from "../generated";

export const SHARE_ACCOUNT_SEED = "share_account";

export async function getShareAccountAddress(
  owner: Address,
  market: Address,
  shareAccountId: number,
  programId: Address = OPPORTUNITY_MARKET_PROGRAM_ADDRESS
): Promise<ProgramDerivedAddress> {
  const addressEncoder = getAddressEncoder();
  const idBytes = new Uint8Array(4);
  new DataView(idBytes.buffer).setUint32(0, shareAccountId, true);
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      SHARE_ACCOUNT_SEED,
      addressEncoder.encode(owner),
      addressEncoder.encode(market),
      idBytes,
    ],
  });
}
