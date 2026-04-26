#!/usr/bin/env node
/**
 * Минт SPL-токена через token_minter. Запускать из program/:
 *   RPC_URL=https://api.devnet.solana.com node scripts/mint-token.js <name> <symbol>
 * Без аргументов — name=DemoToken, symbol=DEMO.
 * Требует: контракты задеплоены, oracle инициализирован, кошелёк профинансирован.
 */
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

const ORACLE_PROGRAM_ID = new PublicKey("HQtxovaUN4EFi9KpSTRNAMmYi8NYaZFPK9mSJQqDpAZM");
const MINTER_PROGRAM_ID = new PublicKey("DyasXoBLYjZ3nhsAWiTXfeZNLF4biDQ563XhYBGXjrp");
const MPL_TOKEN_METADATA_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const SYSVAR_RENT = new PublicKey("SysvarRent111111111111111111111111111111111");

const ORACLE_SEED = Buffer.from("oracle_state");
const MINTER_SEED = Buffer.from("minter_config");
const METADATA_SEED = Buffer.from("metadata");

// sha256("global:mint_token")[0..8]
const MINT_TOKEN_DISCRIMINATOR = Buffer.from([172, 137, 183, 14, 207, 110, 234, 56]);

const NAME = process.argv[2] || "DemoToken";
const SYMBOL = process.argv[3] || "DEMO";
const URI = process.argv[4] || "";

function encodeBorshString(s) {
  const utf8 = Buffer.from(s, "utf8");
  const out = Buffer.alloc(4 + utf8.length);
  out.writeUInt32LE(utf8.length, 0);
  utf8.copy(out, 4);
  return out;
}

async function main() {
  const rpcUrl = process.env.RPC_URL || process.env.SOLANA_RPC_HTTP || "http://127.0.0.1:8899";
  const walletPath = process.env.ANCHOR_WALLET ||
    path.join(process.env.HOME || "", ".config/solana/id.json");

  const connection = new Connection(rpcUrl, "confirmed");
  const user = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
  );
  const treasury = user.publicKey; // init-скрипт ставит treasury = wallet
  const mintKp = Keypair.generate();

  const [configPda] = PublicKey.findProgramAddressSync([MINTER_SEED], MINTER_PROGRAM_ID);
  const [oraclePda] = PublicKey.findProgramAddressSync([ORACLE_SEED], ORACLE_PROGRAM_ID);
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [METADATA_SEED, MPL_TOKEN_METADATA_ID.toBytes(), mintKp.publicKey.toBytes()],
    MPL_TOKEN_METADATA_ID
  );
  const userAta = getAssociatedTokenAddressSync(mintKp.publicKey, user.publicKey);

  const decimals = 6;
  const initialSupply = 1_000_000n;

  const nameEnc = encodeBorshString(NAME.slice(0, 32));
  const symbolEnc = encodeBorshString(SYMBOL.slice(0, 10));
  const uriEnc = encodeBorshString(URI.slice(0, 200));

  const data = Buffer.alloc(17 + nameEnc.length + symbolEnc.length + uriEnc.length);
  MINT_TOKEN_DISCRIMINATOR.copy(data, 0);
  data[8] = decimals;
  data.writeBigUInt64LE(initialSupply, 9);
  let off = 17;
  nameEnc.copy(data, off); off += nameEnc.length;
  symbolEnc.copy(data, off); off += symbolEnc.length;
  uriEnc.copy(data, off);

  const ix = new TransactionInstruction({
    programId: MINTER_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: ORACLE_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: oraclePda, isSigner: false, isWritable: false },
      { pubkey: mintKp.publicKey, isSigner: true, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: MPL_TOKEN_METADATA_ID, isSigner: false, isWritable: false },
      { pubkey: metadataPda, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [user, mintKp], {
    commitment: "confirmed",
  });

  const cluster = rpcUrl.includes("devnet") ? "devnet"
    : rpcUrl.includes("mainnet") ? "mainnet-beta"
    : "custom";

  console.log(`MINT_PUBKEY=${mintKp.publicKey.toBase58()}`);
  console.log(`SIGNATURE=${sig}`);
  console.log(`NAME=${NAME}`);
  console.log(`SYMBOL=${SYMBOL}`);
  console.log(`EXPLORER=https://explorer.solana.com/tx/${sig}?cluster=${cluster}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
