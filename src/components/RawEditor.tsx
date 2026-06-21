interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function RawEditor({ value, onChange }: Props) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "var(--content-width)",
        margin: "0 auto",
        padding: "var(--content-padding)",
        border: "none",
        outline: "none",
        resize: "none",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.6,
        color: "var(--text)",
        background: "var(--bg)",
      }}
    />
  );
}
