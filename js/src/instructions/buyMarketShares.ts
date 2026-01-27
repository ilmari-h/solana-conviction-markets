import { Program, BN, type AnchorProvider } from "@coral-xyz/anchor";
import type { PublicKey, Transaction } from "@solana/web3.js";
import {
  getCompDefAccOffset,
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getCompDefAccAddress,
  getMXEPublicKey,
} from "@arcium-hq/client";
import { PROGRAM_ID, COMP_DEF_OFFSETS } from "../constants";
import {
  deriveShareAccountPda,
  generateComputationOffset,
  generateNonce,
  nonceToU128,
  createEncryptionContext,
  encryptBuySharesInput,
  ARCIUM_CLUSTER_OFFSET,
  getClusterAddress,
} from "../utils";
import type { X25519Keypair } from "../types";
import IDL from "../idl/conviction_market.json";
import type { ConvictionMarket } from "../idl/conviction_market";

/**
 * Parameters for buying market shares
 */
export interface BuyMarketSharesParams {
  /** User buying shares */
  signer: PublicKey;
  /** User's X25519 keypair for encryption */
  userX25519Keypair: X25519Keypair;
  /** Market PDA to buy shares in */
  market: PublicKey;
  /** Number of shares to buy (plain value, will be encrypted) */
  amount: number | BN;
  /** Selected option index (plain value, will be encrypted) */
  selectedOption: number;
  /** Optional authorized reader X25519 public key for disclosure */
  authorizedReaderX25519Pubkey?: Uint8Array;
  /** Optional program ID (defaults to PROGRAM_ID) */
  programId?: PublicKey;
}

/**
 * Result from building buy market shares transaction
 */
export interface BuyMarketSharesResult {
  /** Transaction to sign and send */
  transaction: Transaction;
  /** PDA of the share account */
  shareAccountPda: PublicKey;
  /** Computation offset (pass to awaitComputationFinalization) */
  computationOffset: BN;
}

/**
 * Builds a transaction to buy market shares with encrypted input
 *
 * User purchases shares for a market option using encrypted computation.
 * The amount and selected option are encrypted automatically.
 * Deducts from vote token balance and stores encrypted share state.
 * Only works during the staking period.
 *
 * @param provider - Anchor provider for connection
 * @param params - Buy market shares parameters
 * @returns Transaction to sign and send, share account PDA, and computation offset
 */
export async function buyMarketShares(
  provider: AnchorProvider,
  params: BuyMarketSharesParams
): Promise<BuyMarketSharesResult> {
  const programId = params.programId ?? PROGRAM_ID;
  const program = new Program(
    IDL as ConvictionMarket,
    provider
  ) as Program<ConvictionMarket>;

  const clusterAccount = getClusterAddress();

  // Get MXE public key for encryption
  const mxePublicKey = await getMXEPublicKey(provider, programId);
  if (!mxePublicKey) {
    throw new Error("Failed to fetch MXE public key");
  }

  // Derive share account
  const [shareAccountPda] = deriveShareAccountPda(
    params.signer,
    params.market,
    programId
  );

  // Auto-generate computation offset and nonces
  const computationOffset = generateComputationOffset();
  const inputNonce = generateNonce();
  const inputNonceBN = nonceToU128(inputNonce);
  const disclosureNonce = generateNonce();
  const disclosureNonceBN = nonceToU128(disclosureNonce);

  // Create encryption context and encrypt inputs
  const encryptionContext = createEncryptionContext(
    params.userX25519Keypair,
    mxePublicKey
  );

  const amountBigInt =
    typeof params.amount === "number"
      ? BigInt(params.amount)
      : BigInt(params.amount.toString());

  const { amountCiphertext, selectedOptionCiphertext } = encryptBuySharesInput(
    encryptionContext,
    amountBigInt,
    BigInt(params.selectedOption),
    inputNonce
  );

  // Use user's own pubkey for disclosure if not specified
  const authorizedReaderPubkey =
    params.authorizedReaderX25519Pubkey ?? params.userX25519Keypair.publicKey;

  const transaction = await program.methods
    .buyMarketShares(
      computationOffset,
      Array.from(amountCiphertext),
      Array.from(selectedOptionCiphertext),
      Array.from(params.userX25519Keypair.publicKey),
      inputNonceBN,
      Array.from(authorizedReaderPubkey),
      disclosureNonceBN
    )
    .accountsPartial({
      market: params.market,
      computationAccount: getComputationAccAddress(
        ARCIUM_CLUSTER_OFFSET,
        computationOffset
      ),
      clusterAccount,
      mxeAccount: getMXEAccAddress(programId),
      mempoolAccount: getMempoolAccAddress(ARCIUM_CLUSTER_OFFSET),
      executingPool: getExecutingPoolAccAddress(ARCIUM_CLUSTER_OFFSET),
      compDefAccount: getCompDefAccAddress(
        programId,
        Buffer.from(
          getCompDefAccOffset(COMP_DEF_OFFSETS.BUY_CONVICTION_MARKET_SHARES)
        ).readUInt32LE()
      ),
    })
    .transaction();

  return {
    transaction,
    shareAccountPda,
    computationOffset,
  };
}
