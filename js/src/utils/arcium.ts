import { PublicKey } from "@solana/web3.js";
import type { BN } from "@coral-xyz/anchor";

/**
 * Arcium cluster offset for devnet
 */
export const ARCIUM_CLUSTER_OFFSET = 456;

/**
 * Pre-computed Arcium addresses for the cluster
 * These are constant for ARCIUM_CLUSTER_OFFSET = 456
 */
export const CLUSTER_ADDRESS = new PublicKey(
  "DzaQCyfybroycrNqE5Gk7LhSbWD2qfCics6qptBFbr95"
);
export const MEMPOOL_ADDRESS = new PublicKey(
  "Ex7BD8o8PK1y2eXDd38Jgujj93uHygrZeWXDeGAHmHtN"
);
export const EXECUTING_POOL_ADDRESS = new PublicKey(
  "4mcrgNZzJwwKrE3wXMHfepT8htSBmGqBzDYPJijWooog"
);

/**
 * Pre-computed MXE address for the program
 */
export const MXE_ADDRESS = new PublicKey(
  "9ZtprvNpFCzxuKewDRpmByWLXrxFfGZcrfY6TZTdpvGu"
);

/**
 * Pre-computed MXE X25519 public key for encryption
 * This is the encryption key used for MPC computations
 */
export const MXE_X25519_PUBKEY = new Uint8Array([
  86, 128, 27, 68, 105, 225, 151, 107, 234, 191, 106, 144, 73, 64, 231, 222,
  106, 54, 63, 75, 115, 210, 248, 234, 23, 107, 255, 189, 49, 228, 35, 32,
]);

/**
 * Pre-computed computation definition addresses
 * These are constant for the program and computation definition names
 */
export const COMP_DEF_ADDRESSES = {
  INIT_VOTE_TOKEN_ACCOUNT: new PublicKey(
    "8cJL5BUsL8RtZfZ221M787Vm5kYptFUY65HEZRnX8J6U"
  ),
  BUY_VOTE_TOKENS: new PublicKey(
    "6tqXdWgxnLVn9iVgaMR5rHezWBWJNAEHYq9TLcM9Qu1B"
  ),
  CLAIM_VOTE_TOKENS: new PublicKey(
    "BMbKGJUuSEf198ZNWrFfihBG5PhC6fbLeVRheYpyyzW9"
  ),
  BUY_CONVICTION_MARKET_SHARES: new PublicKey(
    "7DZfQXSRViCZUyzdCxbJnTPgVJJZ4H7a2PZyLfcmp8Np"
  ),
  INIT_MARKET_SHARES: new PublicKey(
    "3PoitQnNeBTDUvPBm8NRDn8tgfvK2rTBFHS2xzZv72tb"
  ),
  REVEAL_SHARES: new PublicKey(
    "DUDK7NEvBXta65uqSX12TNEcNSJYoterhVB9nfkfhA8f"
  ),
} as const;

/**
 * Returns the cluster address
 * @deprecated Use CLUSTER_ADDRESS constant instead
 */
export function getClusterAddress() {
  return CLUSTER_ADDRESS;
}

/**
 * Arcium program ID for PDA derivation
 */
const ARCIUM_PROGRAM_ID = new PublicKey(
  "ARCGL1vmM2YKqmxjVV8LaD9Qi98N2CvT6jjzk6QmqLM"
);

/**
 * Computation account seed constant
 */
const COMPUTATION_ACC_SEED = "ComputationAccount";

/**
 * Derives the computation account address for a given offset
 * This replicates the PDA derivation from Arcium's getComputationAccAddress
 *
 * @param clusterOffset - The cluster offset (should be ARCIUM_CLUSTER_OFFSET)
 * @param computationOffset - The unique computation offset
 * @returns The computation account public key
 */
export function getComputationAccAddress(
  clusterOffset: number,
  computationOffset: BN
): PublicKey {
  // Convert cluster offset to buffer (u32 LE)
  const clusterOffsetBuffer = Buffer.alloc(4);
  clusterOffsetBuffer.writeUInt32LE(clusterOffset, 0);

  // Convert computation offset to buffer (u64 LE) using BN's toArrayLike
  const computationOffsetBuffer = computationOffset.toArrayLike(
    Buffer,
    "le",
    8
  );

  // The computation account PDA is derived with seeds:
  // ["ComputationAccount", cluster_offset_bytes, computation_offset_bytes]
  const [computationAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(COMPUTATION_ACC_SEED),
      clusterOffsetBuffer,
      computationOffsetBuffer,
    ],
    ARCIUM_PROGRAM_ID
  );

  return computationAddress;
}

/**
 * Returns the MXE address for the program
 * @deprecated Use MXE_ADDRESS constant instead
 */
export function getMXEAccAddress(): PublicKey {
  return MXE_ADDRESS;
}

/**
 * Returns the mempool address
 * @deprecated Use MEMPOOL_ADDRESS constant instead
 */
export function getMempoolAccAddress(): PublicKey {
  return MEMPOOL_ADDRESS;
}

/**
 * Returns the executing pool address
 * @deprecated Use EXECUTING_POOL_ADDRESS constant instead
 */
export function getExecutingPoolAccAddress(): PublicKey {
  return EXECUTING_POOL_ADDRESS;
}