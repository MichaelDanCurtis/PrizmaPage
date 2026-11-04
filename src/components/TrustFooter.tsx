import type { VerifyResult } from "../lib/signing";

interface Props {
  filename: string;
  originDomain: string | null;
  verifyResult: VerifyResult | null;
}

/// The faint footer in the viewer showing filename + signature status.
/// verifyResult drives the signature indicator:
///   null      → (still loading) show nothing signature-specific
///   unsigned  → "unsigned"
///   valid     → "✓ signed (keyid)"
///   invalid   → "✗ invalid signature"
export function TrustFooter({ filename, originDomain, verifyResult }: Props) {
  let sigStatus = "unsigned";
  if (verifyResult?.state === "valid") sigStatus = `✓ signed (${verifyResult.keyid.slice(0, 8)})`;
  else if (verifyResult?.state === "invalid") sigStatus = "✗ invalid signature";
  else if (verifyResult?.state === "unsigned") sigStatus = "unsigned";

  const from = originDomain ? `from ${originDomain}` : "";
  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        left: "50%",
        transform: "translateX(-50%)",
        font: "var(--font-footer)",
        color: "var(--text-faint)",
        background: "rgba(255,255,255,0.85)",
        padding: "2px 8px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border-soft)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {filename}{from ? ` · ${from}` : ""} · {sigStatus}
    </div>
  );
}
