import { getMXEPublicKey } from "@arcium-hq/client";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("bnchXx34qGANGyEL6MxTYdG8iXmUmSPyQFAGhxj1VKn");

async function main() {
  const connection = new Connection("https://api.devnet.solana.com");
  const wallet = { publicKey: Keypair.generate().publicKey } as any;
  const provider = new AnchorProvider(connection, wallet, {});

  console.log("Fetching MXE X25519 public key from devnet...");
  const mxePublicKey = await getMXEPublicKey(provider, PROGRAM_ID);

  if (!mxePublicKey) {
    console.error("Failed to fetch MXE public key");
    return;
  }

  console.log("\nMXE X25519 Public Key:");
  console.log("Array:", JSON.stringify(Array.from(mxePublicKey)));
  console.log("Hex:", Buffer.from(mxePublicKey).toString("hex"));
  console.log("\nAdd to arcium.ts:");
  console.log(`export const MXE_X25519_PUBKEY = new Uint8Array([${Array.from(mxePublicKey)}]);`);
}

main();
