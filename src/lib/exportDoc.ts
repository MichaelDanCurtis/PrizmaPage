/// Markdown export: the document source, verbatim.
export function buildMarkdownExport(source: string): string {
  return source;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(text: string): string {
  let t = escapeHtml(text);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

/// Minimal markdown→HTML for a readable standalone export (headings,
/// paragraphs, bold/italic/code, lists, links, code fences). Not a full
/// CommonMark engine — the goal is a handoff doc the recipient can read.
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

function markdownToHtml(md: string, toc?: { level: number; text: string; slug: string }[]): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  let inFence = false;
  let codeBuf: string[] = [];
  const flushCode = () => { if (codeBuf.length) { out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`); codeBuf = []; } };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) { if (inFence) { flushCode(); inFence = false; } else { inFence = true; } i++; continue; }
    if (inFence) { codeBuf.push(line); i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const inner = inlineMd(h[2]);
      const slug = slugify(h[2]);
      if (toc) toc.push({ level, text: h[2], slug });
      out.push(`<h${level} id="${slug}">${inner}</h${level}>`);
      i++; continue;
    }
    if (/^[*+-]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[*+-]\s+/.test(lines[i])) { items.push(`<li>${inlineMd(lines[i].replace(/^[*+-]\s+/, ""))}</li>`); i++; }
      out.push(`<ul>${items.join("")}</ul>`); continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(`<li>${inlineMd(lines[i].replace(/^\d+\.\s/, ""))}</li>`); i++; }
      out.push(`<ol>${items.join("")}</ol>`); continue;
    }
    if (line.trim() === "") { i++; continue; }
    out.push(`<p>${inlineMd(line)}</p>`); i++;
  }
  flushCode();
  return out.join("\n");
}

/// HTML export: a self-contained styled document with the prose rendered,
/// including a generated table-of-contents nav from the headings.
export function buildHtmlExport(source: string): string {
  const toc: { level: number; text: string; slug: string }[] = [];
  const body = markdownToHtml(source, toc);
  const tocNav = toc.length > 0
    ? `<nav style="border:1px solid #ddd;border-radius:6px;padding:12px 16px;margin-bottom:24px;background:#fafafa"><div style="font-weight:600;margin-bottom:8px">Contents</div><ul style="padding-left:20px;margin:0">${toc.map((h) => `<li style="margin-left:${(h.level - 1) * 12}px"><a href="#${h.slug}">${escapeHtml(h.text)}</a></li>`).join("")}</ul></nav>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PrizmaPage document</title>
<style>
  body { font: 16px/1.7 -apple-system, "Inter", system-ui, sans-serif; color: #1a1a1a; max-width: 720px; margin: 40px auto; padding: 0 24px; }
  h1,h2,h3 { line-height: 1.25; }
  pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow: auto; }
  code { font-family: "SF Mono", monospace; font-size: 0.9em; }
  a { color: #4f46e5; }
  @media (prefers-color-scheme: dark) { body { background: #0d1117; color: #e6edf3; } pre { background: #161b22; } }
</style>
</head>
<body>
${tocNav}
${body}
</body>
</html>`;
}

/// Trigger a file download of `content` (works in the browser dev harness
/// and the Tauri webview; the OS handles the save location). Avoids a Rust
/// write command.
export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
