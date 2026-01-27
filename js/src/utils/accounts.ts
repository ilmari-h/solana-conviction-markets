import { Program, type AnchorProvider } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import type { ConvictionMarket } from "../idl/conviction_market";
import { createEncryptionContext, fetchMXEPublicKey } from "./encryption";
import IDL from "../idl/conviction_market.json";

/**
 * Creates a Program instance for the Conviction Market program
 *
 * @param provider - Anchor provider
 * @returns Program instance
 */
export function createProgram(provider: AnchorProvider): Program<ConvictionMarket> {
  return new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;
}

/**
 * Fetches and decrypts a user's vote token balance
 *
 * @param program - Anchor program instance
 * @param voteTokenAccountPda - PDA of the vote token account
 * @param userX25519Keypair - User's X25519 keypair for decryption
 * @returns Decrypted balance and account data
 * @throws If account doesn't exist or decryption fails
 */
export async function fetchAndDecryptVoteTokenBalance(
  program: Program<ConvictionMarket>,
  voteTokenAccountPda: PublicKey,
  userX25519Keypair: { publicKey: Uint8Array; secretKey: Uint8Array }
) {
  const account = await program.account.voteTokenAccount.fetch(voteTokenAccountPda);

  // Fetch MXE public key and create encryption context
  const mxePublicKey = await fetchMXEPublicKey(
    program.provider as AnchorProvider,
    program.programId
  );
  const encryptionContext = createEncryptionContext(userX25519Keypair, mxePublicKey);

  const decrypted = encryptionContext.cipher.decrypt(
    account.encryptedState,
    Uint8Array.from(account.stateNonce.toArray("le", 16))
  );

  if (!decrypted[0]) {
    throw new Error("Failed to decrypt balance");
  }

  return {
    balance: decrypted[0],
    account,
  };
}

export type DecryptedVoteTokenBalance = Awaited<ReturnType<typeof fetchAndDecryptVoteTokenBalance>>;

/**
 * Fetches and decrypts a user's share account
 *
 * @param program - Anchor program instance
 * @param shareAccountPda - PDA of the share account
 * @param userX25519Keypair - User's X25519 keypair for decryption
 * @returns Decrypted share data and account data
 * @throws If account doesn't exist or decryption fails
 */
export async function fetchAndDecryptShareAccount(
  program: Program<ConvictionMarket>,
  shareAccountPda: PublicKey,
  userX25519Keypair: { publicKey: Uint8Array; secretKey: Uint8Array }
) {
  const account = await program.account.shareAccount.fetch(shareAccountPda);

  // Fetch MXE public key and create encryption context
  const mxePublicKey = await fetchMXEPublicKey(
    program.provider as AnchorProvider,
    program.programId
  );
  const encryptionContext = createEncryptionContext(userX25519Keypair, mxePublicKey);

  const decrypted = encryptionContext.cipher.decrypt(
    account.encryptedState,
    Uint8Array.from(account.stateNonce.toArray("le", 16))
  );

  if (!decrypted[0] || !decrypted[1]) {
    throw new Error("Failed to decrypt share account");
  }

  return {
    amount: decrypted[0],
    selectedOption: decrypted[1],
    account,
  };
}

export type DecryptedShareAccount = Awaited<ReturnType<typeof fetchAndDecryptShareAccount>>;

/**
 * Fetches and decrypts a market's available shares
 *
 * @param program - Anchor program instance
 * @param marketPda - PDA of the conviction market
 * @param userX25519Keypair - User's X25519 keypair for decryption
 * @returns Decrypted available shares and account data
 * @throws If account doesn't exist or decryption fails
 */
export async function fetchAndDecryptMarketShares(
  program: Program<ConvictionMarket>,
  marketPda: PublicKey,
  userX25519Keypair: { publicKey: Uint8Array; secretKey: Uint8Array }
) {
  const account = await program.account.convictionMarket.fetch(marketPda);

  // Fetch MXE public key and create encryption context
  const mxePublicKey = await fetchMXEPublicKey(
    program.provider as AnchorProvider,
    program.programId
  );
  const encryptionContext = createEncryptionContext(userX25519Keypair, mxePublicKey);

  const decrypted = encryptionContext.cipher.decrypt(
    account.encryptedAvailableShares,
    Uint8Array.from(account.stateNonce.toArray("le", 16))
  );

  if (!decrypted[0]) {
    throw new Error("Failed to decrypt market shares");
  }

  return {
    availableShares: decrypted[0],
    account,
  };
}

export type DecryptedMarketShares = Awaited<ReturnType<typeof fetchAndDecryptMarketShares>>;

/**
 * Fetches a vote token account without decryption
 *
 * @param program - Anchor program instance
 * @param voteTokenAccountPda - PDA of the vote token account
 * @returns Vote token account data
 * @throws If account doesn't exist
 */
export async function fetchVoteTokenAccount(
  program: Program<ConvictionMarket>,
  voteTokenAccountPda: PublicKey
) {
  return await program.account.voteTokenAccount.fetch(voteTokenAccountPda);
}

export type VoteTokenAccountData = Awaited<ReturnType<typeof fetchVoteTokenAccount>>;

/**
 * Fetches a share account without decryption
 *
 * @param program - Anchor program instance
 * @param shareAccountPda - PDA of the share account
 * @returns Share account data
 * @throws If account doesn't exist
 */
export async function fetchShareAccount(
  program: Program<ConvictionMarket>,
  shareAccountPda: PublicKey
) {
  return await program.account.shareAccount.fetch(shareAccountPda);
}

export type ShareAccountData = Awaited<ReturnType<typeof fetchShareAccount>>;

/**
 * Fetches a conviction market account
 *
 * @param program - Anchor program instance
 * @param marketPda - PDA of the conviction market
 * @returns Conviction market account data
 * @throws If account doesn't exist
 */
export async function fetchConvictionMarket(
  program: Program<ConvictionMarket>,
  marketPda: PublicKey
) {
  return await program.account.convictionMarket.fetch(marketPda);
}

export type ConvictionMarketAccount = Awaited<ReturnType<typeof fetchConvictionMarket>>;

/**
 * Fetches a market option account
 *
 * @param program - Anchor program instance
 * @param optionPda - PDA of the market option
 * @returns Market option account data
 * @throws If account doesn't exist
 */
export async function fetchMarketOption(
  program: Program<ConvictionMarket>,
  optionPda: PublicKey
) {
  return await program.account.convictionMarketOption.fetch(optionPda);
}

export type ConvictionMarketOptionData = Awaited<ReturnType<typeof fetchMarketOption>>;

/**
 * Checks if a vote token account exists
 *
 * @param provider - Anchor provider
 * @param voteTokenAccountPda - PDA of the vote token account
 * @returns True if account exists, false otherwise
 */
export async function voteTokenAccountExists(
  provider: AnchorProvider,
  voteTokenAccountPda: PublicKey
): Promise<boolean> {
  const accountInfo = await provider.connection.getAccountInfo(voteTokenAccountPda);
  return accountInfo !== null;
}

/**
 * Checks if a share account exists
 *
 * @param provider - Anchor provider
 * @param shareAccountPda - PDA of the share account
 * @returns True if account exists, false otherwise
 */
export async function shareAccountExists(
  provider: AnchorProvider,
  shareAccountPda: PublicKey
): Promise<boolean> {
  const accountInfo = await provider.connection.getAccountInfo(shareAccountPda);
  return accountInfo !== null;
}
