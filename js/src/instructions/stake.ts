import { type TransactionSigner, type Address } from "@solana/kit";
import {
  getStakeInstructionAsync,
  type StakeInstruction,
} from "../generated";
import { type ArciumConfig, getComputeAccounts } from "../arcium/computeAccounts";
import { type ByteArray, toNumberArray } from "../utils";

export interface StakeParams {
  signer: TransactionSigner;
  market: Address;
  userEta: Address;
  shareAccountId: number;
  amountCiphertext: ByteArray;
  selectedOptionCiphertext: ByteArray;
  inputNonce: bigint;
  authorizedReaderPubkey: ByteArray;
  authorizedReaderNonce: bigint;
}

export async function stake(
  input: StakeParams,
  config: ArciumConfig
): Promise<StakeInstruction> {
  const {
    signer,
    market,
    userEta,
    shareAccountId,
    amountCiphertext,
    selectedOptionCiphertext,
    inputNonce,
    authorizedReaderPubkey,
    authorizedReaderNonce,
  } = input;

  return getStakeInstructionAsync({
    ...getComputeAccounts("buy_opportunity_market_shares", config),
    signer,
    market,
    userEta,
    shareAccountId,
    amountCiphertext: toNumberArray(amountCiphertext),
    selectedOptionCiphertext: toNumberArray(selectedOptionCiphertext),
    inputNonce,
    authorizedReaderPubkey: toNumberArray(authorizedReaderPubkey),
    authorizedReaderNonce,
  });
}
