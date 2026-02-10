import { type TransactionSigner, type Address } from "@solana/kit";
import {
  getAddMarketOptionInstructionAsync,
  type AddMarketOptionInstruction,
} from "../generated";
import { type ArciumConfig, getComputeAccounts } from "../arcium/computeAccounts";
import { type ByteArray, toNumberArray } from "../utils";

export interface AddMarketOptionParams {
  creator: TransactionSigner;
  market: Address;
  sourceVta: Address;
  lockedVta: Address;
  optionIndex: number;
  name: string;
  amount: bigint;
  userPubkey: ByteArray;
  lockedVtaNonce: bigint;
}

export async function addMarketOption(
  input: AddMarketOptionParams,
  config: ArciumConfig,
): Promise<AddMarketOptionInstruction> {
  const {
    creator,
    market,
    sourceVta,
    lockedVta,
    optionIndex,
    name,
    amount,
    userPubkey,
    lockedVtaNonce,
  } = input;

  return getAddMarketOptionInstructionAsync({
    ...getComputeAccounts("lock_option_deposit", config),
    creator,
    market,
    sourceVta,
    lockedVta,
    optionIndex,
    name,
    amount,
    userPubkey: toNumberArray(userPubkey),
    lockedVtaNonce,
  });
}
