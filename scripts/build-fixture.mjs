// Minimal save/compile path: MDX source → compiled JS → .mdxz zip.
// This is NOT the editor. It exists so Phase 0 has real packages to open.
import { compile } from "@mdx-js/mdx";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import AdmZip from "adm-zip";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

async function compileMdx(sourcePath) {
  const source = readFileSync(sourcePath, "utf8");
  // compile() with outputFormat: 'function-body' turns MDX into a JS function
  // body (layer 2, executable) that the runner can evaluate via run().
  // The default 'program' format emits import/export and is NOT runnable by run().
  const compiled = String(await compile(source, { outputFormat: "function-body" }));
  return compiled;
}

function newPackageWithManifest(mdxPath, manifest) {
  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));
  // Layer 1: the original prose, plaintext. Vectorizable.
  zip.addFile("content.md", Buffer.from(readFileSync(mdxPath, "utf8")));
  return zip;
}

async function buildAll() {
  mkdirSync(join(root, "src-tauri", "tests", "fixtures"), { recursive: true });
  mkdirSync(join(root, "src-tauri", "resources"), { recursive: true });

  // hello: prose + a real compiled build so the runner has something to execute.
  const helloZip = newPackageWithManifest(join(root, "fixtures", "hello.mdx"), {
    version: "0.1.0",
    origin_domain: null,
    capabilities: [],
    signature: null,
  });
  const helloCompiled = await compileMdx(join(root, "fixtures", "hello.mdx"));
  helloZip.addFile("build/main.js", Buffer.from(helloCompiled));
  helloZip.writeZip(join(root, "src-tauri", "tests", "fixtures", "hello.mdxz"));

  // privileged: declares network capability, so we can see the policy engine allow it.
  const privZip = newPackageWithManifest(
    join(root, "fixtures", "privileged.mdx"),
    {
      version: "0.1.0",
      origin_domain: "acme.com",
      capabilities: [{ category: "network", scopes: ["github.com"] }],
      signature: null,
    }
  );
  const privCompiled = await compileMdx(join(root, "fixtures", "privileged.mdx"));
  privZip.addFile("build/main.js", Buffer.from(privCompiled));
  privZip.writeZip(join(root, "src-tauri", "tests", "fixtures", "privileged.mdxz"));

  // welcome: the first-run intro doc, shipped as a BUNDLED ASSET (not just a
  // test fixture) so the EmptyState can open it without any user file present.
  const welcomeZip = newPackageWithManifest(join(root, "fixtures", "welcome.mdx"), {
    version: "0.1.0",
    origin_domain: "prizmapage.app",
    capabilities: [],
    signature: null,
  });
  const welcomeCompiled = await compileMdx(join(root, "fixtures", "welcome.mdx"));
  welcomeZip.addFile("build/main.js", Buffer.from(welcomeCompiled));
  // Ship to both locations: test fixture (for smoke tests) and bundled resource.
  welcomeZip.writeZip(join(root, "src-tauri", "tests", "fixtures", "welcome.mdxz"));
  welcomeZip.writeZip(join(root, "src-tauri", "resources", "welcome.mdxz"));

  console.log("Built fixtures: hello.mdxz, privileged.mdxz, welcome.mdxz");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
