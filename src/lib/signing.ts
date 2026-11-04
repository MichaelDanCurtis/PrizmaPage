import { invoke } from "@tauri-apps/api/core";

export type VerifyResult =
  | { state: "unsigned" }
  | { state: "valid"; keyid: string }
  | { state: "invalid"; reason: string };

export interface KeypairInfo {
  pubkey: string;
  keyid: string;
}

export function signingGenerateKeypair(): Promise<KeypairInfo> {
  return invoke<KeypairInfo>("signing_generate_keypair");
}

export function signingSign(path: string, keyid: string): Promise<void> {
  return invoke("signing_sign", { path, keyid });
}

export function signingVerify(path: string): Promise<VerifyResult> {
  return invoke<VerifyResult>("signing_verify", { path });
}
