import { useEffect, useState } from "react";
import { openDocument, grantDeclaredCapabilities, type Manifest } from "./lib/package";
import { runMdxModule, type MDXComponent } from "./lib/runner";
import { checkCapability, type Decision } from "./lib/capability";

// For Phase 0 verification we open a fixture by path. Phase 2 adds the open dialog.
const FIXTURE_PATH = "../src-tauri/tests/fixtures/hello.mdxz";

export function App() {
  const [Component, setComponent] = useState<MDXComponent | null>(null);
  const [text, setText] = useState<string>("");
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [netDecision, setNetDecision] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const doc = await openDocument(FIXTURE_PATH);
        setText(doc.content_md);
        setManifest(doc.manifest);
        await grantDeclaredCapabilities(doc.manifest);

        const C = await runMdxModule(doc.build_main_js);
        setComponent(() => C);

        // The hello fixture declares NO capabilities, so the policy engine
        // (which starts at zero) must DENY this network request.
        const decision = await checkCapability({ kind: "Network", host: "evil.com" });
        setNetDecision(decision);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1 data-testid="app-title">PrizmaPage</h1>

      {error && (
        <section data-testid="error-panel" style={{ color: "crimson" }}>
          <h2>Error</h2>
          <pre>{error}</pre>
        </section>
      )}

      <section data-testid="layer1-text">
        <h2>Layer 1 (text, always vectorizable)</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{text}</pre>
      </section>

      <section data-testid="layer2-runtime">
        <h2>Layer 2 (compiled, running in sandbox)</h2>
        {Component ? <Component /> : <p>No executable component in this document.</p>}
      </section>

      <section data-testid="policy-panel">
        <h2>Policy engine</h2>
        <p>
          Document requested <code>network: evil.com</code>. Decision:{" "}
          <strong data-testid="net-decision">{netDecision ?? "…"}</strong>
        </p>
        {manifest && (
          <p>
            Declared capabilities: {manifest.capabilities.length} (signature:{" "}
            {manifest.signature ?? "none"})
          </p>
        )}
      </section>
    </div>
  );
}
