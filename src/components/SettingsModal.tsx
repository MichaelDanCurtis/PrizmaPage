import { useState } from "react";
import { ProvidersTab } from "./ProvidersTab";
import { AppearanceTab } from "./AppearanceTab";

interface Props {
  onClose: () => void;
}

type Tab = "providers" | "appearance";

export function SettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("providers");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          width: 560,
          maxWidth: "92vw",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-soft)" }}>
          {(["providers", "appearance"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                color: tab === t ? "var(--accent)" : "var(--text-muted)",
                padding: "12px 20px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: tab === t ? 600 : 500,
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
          <div
            role="button"
            aria-label="Close settings"
            onClick={onClose}
            style={{ marginLeft: "auto", padding: "12px 16px", cursor: "pointer", color: "var(--text-faint)", fontSize: 16 }}
          >
            ✕
          </div>
        </div>
        <div style={{ overflow: "auto", padding: 20 }}>
          {tab === "providers" ? <ProvidersTab /> : <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}
