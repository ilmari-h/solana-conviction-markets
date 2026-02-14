import { type TransactionSigner, type Address } from "@solana/kit";
import {
  getWrapEncryptedTokensInstructionAsync,
  type WrapEncryptedTokensInstruction,
} from "../generated";
import { type ArciumConfig, getComputeAccounts } from "../arcium/computeAccounts";

export interface WrapEncryptedTokensParams {
  signer: TransactionSigner;
  tokenMint: Address;
  /** The EncryptedTokenAccount to wrap tokens into */
  encryptedTokenAccount: Address;
  signerTokenAccount: Address;
  tokenProgram: Address;
  amount: bigint;
}

export async function wrapEncryptedTokens(
  input: WrapEncryptedTokensParams,
  config: ArciumConfig
): Promise<WrapEncryptedTokensInstruction> {
  const { signer, tokenMint, encryptedTokenAccount, signerTokenAccount, tokenProgram, amount } = input;

  return getWrapEncryptedTokensInstructionAsync({
    ...getComputeAccounts("wrap_encrypted_tokens", config),
    signer,
    tokenMint,
    encryptedTokenAccount,
    signerTokenAccount,
    tokenProgram,
    amount,
  });
}
