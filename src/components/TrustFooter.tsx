interface Props {
  filename: string;
  signatureDomain: string | null;
}

export function TrustFooter({ filename, signatureDomain }: Props) {
  const status = signatureDomain ? `signed: ${signatureDomain} ✓` : "unsigned";
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
      {filename} · {status}
    </div>
  );
}
