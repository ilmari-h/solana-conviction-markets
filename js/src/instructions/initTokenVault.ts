import { type TransactionSigner, type Address } from "@solana/kit";
import {
  getInitTokenVaultInstructionAsync,
  type InitTokenVaultInstruction,
} from "../generated";

export interface InitTokenVaultParams {
  /** The signer/payer for the transaction */
  payer: TransactionSigner;
  /** Address that can withdraw tokens from the vault */
  fundManager: Address;
}

export async function initTokenVault(
  input: InitTokenVaultParams
): Promise<InitTokenVaultInstruction> {
  const { payer, fundManager } = input;

  return getInitTokenVaultInstructionAsync({
    payer,
    fundManager,
  });
}
