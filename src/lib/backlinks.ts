import { invoke } from "@tauri-apps/api/core";

export interface Backlink {
  /// The path of the note that contains the link.
  sourcePath: string;
  sourceName: string;
  /// The line of context surrounding the link.
  context: string;
}

/// Read a .mdxz's content.md layer without fully opening it (fast scan).
/// Uses the existing open_document command.
async function readContent(path: string): Promise<string> {
  const doc = await invoke<{ content_md: string }>("open_document", { path });
  return doc.content_md;
}

/// Extract [[wikilink targets]] from markdown text.
export function extractWikilinks(content: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    out.push(m[1]);
  }
  return out;
}

/// Build a backlinks index for a target note name: scan all vault note paths,
/// read each, find references to [[target]]. Returns one Backlink per match.
/// `notePaths` is the flat list of .mdxz paths from vault_list.
export async function findBacklinks(
  targetName: string,
  notePaths: string[]
): Promise<Backlink[]> {
  const results: Backlink[] = [];
  // The target matches if the linking note writes [[targetName]] (case-insensitive,
  // ignoring .mdxz extension differences).
  const target = targetName.replace(/\.mdxz$/i, "").toLowerCase();
  await Promise.all(
    notePaths.map(async (path) => {
      try {
        const content = await readContent(path);
        for (const line of content.split("\n")) {
          const links = extractWikilinks(line);
          if (links.some((l) => l.replace(/\.mdxz$/i, "").toLowerCase() === target)) {
            results.push({
              sourcePath: path,
              sourceName: path.split("/").pop()?.replace(/\.mdxz$/, "") ?? path,
              context: line.trim().slice(0, 200),
            });
          }
        }
      } catch {
        /* skip unreadable notes */
      }
    })
  );
  return results;
}
