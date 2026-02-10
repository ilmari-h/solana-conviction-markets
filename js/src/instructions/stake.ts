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
  userVta: Address;
  shareAccountId: number;
  amountCiphertext: ByteArray;
  selectedOptionCiphertext: ByteArray;
  userPubkey: ByteArray;
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
    userVta,
    shareAccountId,
    amountCiphertext,
    selectedOptionCiphertext,
    userPubkey,
    inputNonce,
    authorizedReaderPubkey,
    authorizedReaderNonce,
  } = input;

  return getStakeInstructionAsync({
    ...getComputeAccounts("buy_opportunity_market_shares", config),
    signer,
    market,
    userVta,
    shareAccountId,
    amountCiphertext: toNumberArray(amountCiphertext),
    selectedOptionCiphertext: toNumberArray(selectedOptionCiphertext),
    userPubkey: toNumberArray(userPubkey),
    inputNonce,
    authorizedReaderPubkey: toNumberArray(authorizedReaderPubkey),
    authorizedReaderNonce,
  });
}
