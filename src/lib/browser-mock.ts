/// Browser-side mock of the Tauri bridge for visual development without Tauri.
/// Load this BEFORE the app boots (in main.tsx when `!window.__TAURI__`).
/// It intercepts `invoke()` calls and returns fixture data so the UI renders.

// The welcome doc as a fixture (matches fixtures/welcome.mdx content).
const WELCOME_CONTENT = `# Welcome to PrizmaPage

You're looking at a \`.mdxz\` document — a shareable, executable mini-app.

## What makes this different from a PDF

A PDF is a frozen picture of a document. A \`.mdxz\` file is a *running program*.

## The thin viewer

Notice what you *don't* see: no toolbar, no menus, no chrome.

## What's next

- **Editor mode** — write MDX directly
- **AI authoring** — ask the AI to build components
- **Sharing** — package a document and send it

This is layer one. The foundation is set; the document is the experience.
`;

export function installBrowserMock() {
  if ((window as any).__TAURI__) return; // Real Tauri present — don't mock.

  console.log("[browser-mock] Installing Tauri bridge mock for visual dev");

  const mockInvoke = async (cmd: string, args?: any): Promise<any> => {
    console.log(`[browser-mock] invoke("${cmd}")`, args);
    switch (cmd) {
      case "open_document": {
        return {
          manifest: {
            version: "0.1.0",
            origin_domain: "prizmapage.app",
            capabilities: [],
            signature: null,
          },
          content_md: WELCOME_CONTENT,
          build_main_js: null,
        };
      }
      case "grant_declared_capabilities":
        return undefined;
      case "recent_documents":
        return [];
      case "add_recent_document":
        return undefined;
      case "welcome_document_path":
        return "/mock/welcome.mdxz";
      case "save_document":
        console.log("[browser-mock] save_document — mocked, no actual write");
        return undefined;
      case "share_document_path":
        console.log("[browser-mock] share — mocked");
        return undefined;
      default:
        console.warn(`[browser-mock] unknown command: ${cmd}`);
        return undefined;
    }
  };

  // Replace the @tauri-apps/api/core invoke.
  // Vite resolves this at import time, so we patch the module.
  (window as any).__TAURI_INTERNALS__ = {
    invoke: mockInvoke,
  };

  // Also patch the plugin-dialog open to return a mock path.
  (window as any).__TAURI_PLUGIN_DIALOG__ = {
    open: async () => "/mock/welcome.mdxz",
  };
}
