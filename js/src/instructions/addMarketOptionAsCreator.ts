import { type TransactionSigner, type Address } from "@solana/kit";
import {
  getAddMarketOptionAsCreatorInstructionAsync,
  type AddMarketOptionAsCreatorInstruction,
} from "../generated";

export interface AddMarketOptionAsCreatorParams {
  creator: TransactionSigner;
  market: Address;
  optionIndex: number;
  name: string;
}

export async function addMarketOptionAsCreator(
  input: AddMarketOptionAsCreatorParams
): Promise<AddMarketOptionAsCreatorInstruction> {
  return getAddMarketOptionAsCreatorInstructionAsync(input);
}
