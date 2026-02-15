import { type TransactionSigner, type Address } from "@solana/kit";
import {
  getInitEncryptedTokenAccountInstructionAsync,
  type InitEncryptedTokenAccountInstruction,
} from "../generated";
import { type ByteArray, toNumberArray } from "../utils";

export interface InitEncryptedTokenAccountParams {
  /** The signer/payer for the transaction */
  signer: TransactionSigner;
  tokenMint: Address;
  /** User's x25519 public key (32 bytes) for encryption */
  userPubkey: ByteArray;
}

export async function initEncryptedTokenAccount(
  input: InitEncryptedTokenAccountParams
): Promise<InitEncryptedTokenAccountInstruction> {
  const { signer, tokenMint, userPubkey } = input;

  return getInitEncryptedTokenAccountInstructionAsync({
    signer,
    tokenMint,
    userPubkey: toNumberArray(userPubkey),
  });
}
