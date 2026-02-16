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
  sourceEta: Address;
  shareAccount: Address;
  optionIndex: number;
  shareAccountId: number;
  name: string;
  amountCiphertext: ByteArray;
  inputNonce: bigint;
  authorizedReaderNonce: bigint;
}

export async function addMarketOption(
  input: AddMarketOptionParams,
  config: ArciumConfig,
): Promise<AddMarketOptionInstruction> {
  const {
    creator,
    market,
    sourceEta,
    shareAccount,
    optionIndex,
    shareAccountId,
    name,
    amountCiphertext,
    inputNonce,
    authorizedReaderNonce,
  } = input;

  return getAddMarketOptionInstructionAsync({
    ...getComputeAccounts("add_option_stake", config),
    creator,
    market,
    sourceEta,
    shareAccount,
    optionIndex,
    shareAccountId,
    name,
    amountCiphertext: toNumberArray(amountCiphertext),
    inputNonce,
    authorizedReaderNonce,
  });
}
