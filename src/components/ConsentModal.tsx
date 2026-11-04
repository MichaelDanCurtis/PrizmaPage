import { useState } from "react";
import type { Capability } from "../lib/capability";
import type { Manifest } from "../lib/package";
import { capabilityRows } from "../lib/capabilityLabels";

interface Props {
  manifest: Manifest;
  filename: string;
  /// Called with the user-approved capability subset. The viewer opens after.
  onGrant: (capabilities: Capability[]) => void;
  /// Called when the user cancels. Nothing is granted.
  onCancel: () => void;
}

/// The capability consent prompt shown at open time when a document declares
/// capabilities. Nothing is granted until the user picks Open.
export function ConsentModal({ manifest, filename, onGrant, onCancel }: Props) {
  const rows = capabilityRows(manifest.capabilities);
  const [allowed, setAllowed] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    rows.forEach((r, i) => {
      init[i] = r.defaultAllow;
    });
    return init;
  });

  const toggle = (i: number) => setAllowed((a) => ({ ...a, [i]: !a[i] }));

  const handleOpen = () => {
    const approved = rows.filter((_, i) => allowed[i]).map((r) => r.capability);
    onGrant(approved);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 400,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          width: 480,
          maxWidth: "92vw",
          maxHeight: "82vh",
          overflow: "auto",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          Open {filename}?
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          From <strong>{manifest.origin_domain ?? "unknown origin"}</strong>. This document wants to:
        </div>

        {rows.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 16 }}>
            This document requests no capabilities.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              <span style={{ fontSize: 16 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{r.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.detail}</div>
              </div>
              <button
                onClick={() => toggle(i)}
                style={{
                  background: allowed[i] ? "var(--accent)" : "var(--bg-muted)",
                  color: allowed[i] ? "white" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                  padding: "4px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                  minWidth: 60,
                }}
              >
                {allowed[i] ? "Allow" : "Deny"}
              </button>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 16, lineHeight: 1.4 }}>
          You're in control. Denied capabilities are blocked at runtime; the document still opens but
          can't use them.
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              padding: "6px 16px",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleOpen}
            style={{
              background: "var(--accent)",
              color: "white",
              border: "none",
              padding: "6px 20px",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
