import { CodeHighlight } from "./CodeHighlight";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

/// Raw MDX source editor. Delegates to CodeHighlight (the Prism
/// backdrop+transparent-textarea editor already used by CodePeek) with the
/// jsx grammar — MDX is JSX-adjacent and jsx covers the markup well.
export function RawEditor({ value, onChange }: Props) {
  return (
    <div style={{ width: "100%", height: "100%", maxWidth: "var(--content-width)", margin: "0 auto", padding: "var(--content-padding)", display: "flex" }}>
      <CodeHighlight value={value} onChange={onChange} language="jsx" />
    </div>
  );
}
