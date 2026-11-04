//! MCP server (Direction 2): the document exposes itself as a JSON-RPC 2.0
//! MCP server over stdio. Editor-mode only; external agents spawn this binary
//! as a child process and call the document's tools (read-only in v1).
//!
//! Transport: line-delimited JSON-RPC over stdin/stdout (the MCP spec's stdio
//! transport). No network surface — the safest possible inbound path.

use crate::manifest::Manifest;
use crate::package;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{BufRead, Write};
use std::path::Path;

#[derive(Debug, thiserror::Error)]
pub enum McpError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("package: {0}")]
    Package(#[from] package::PackageError),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
}

/// A section: heading text + the body lines under it (until the next heading).
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Section {
    pub heading: String,
    pub level: u8,
    pub body: String,
}

/// Parse markdown into sections. Content before the first heading is a section
/// with heading "(intro)" at level 0.
pub fn parse_sections(md: &str) -> Vec<Section> {
    let mut sections: Vec<Section> = Vec::new();
    let mut current: Option<Section> = None;
    for line in md.lines() {
        if let Some(caps) = line.strip_prefix('#') {
            let level = caps.bytes().take_while(|b| *b == b'#').count() + 1;
            // Push the previous section, start a new one.
            if let Some(s) = current.take() {
                sections.push(s);
            }
            let heading = line.trim_start_matches('#').trim().to_string();
            current = Some(Section { heading, level: level as u8, body: String::new() });
        } else if let Some(s) = current.as_mut() {
            if !s.body.is_empty() || !line.trim().is_empty() {
                s.body.push_str(line);
                s.body.push('\n');
            }
        } else {
            // Intro before any heading.
            if !line.trim().is_empty() {
                if current.is_none() {
                    current = Some(Section { heading: "(intro)".into(), level: 0, body: String::new() });
                }
                if let Some(s) = current.as_mut() {
                    s.body.push_str(line);
                    s.body.push('\n');
                }
            }
        }
    }
    if let Some(s) = current.take() {
        sections.push(s);
    }
    sections
}

/// A JSON-RPC 2.0 request.
#[derive(Debug, Deserialize)]
struct RpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

/// The tools this MCP server exposes.
fn tools_list() -> Value {
    json!([
        { "name": "list_sections", "description": "List the document's headings and their structure." },
        { "name": "read_section", "description": "Read the body text under a heading.", "inputSchema": { "type": "object", "properties": { "name": { "type": "string" } }, "required": ["name"] } },
        { "name": "read_full", "description": "Read the entire document content." },
        { "name": "list_components", "description": "List the JSX components in the document." },
        { "name": "get_metadata", "description": "Read the document's manifest metadata." },
        { "name": "vault.remember", "description": "Deposit a memory as a new note in the vault's Memories/ folder. Agents use this to persist insights.", "inputSchema": { "type": "object", "properties": { "title": { "type": "string" }, "content": { "type": "string" }, "source": { "type": "string" }, "tags": { "type": "array", "items": { "type": "string" } } }, "required": ["title", "content"] } }
    ])
}

/// Dispatch a tool call. Returns the result value (to be wrapped in content blocks).
fn handle_tool(name: &str, params: &Value, content_md: &str, manifest: &Manifest, vault_path: Option<&std::path::Path>) -> Value {
    match name {
        "list_sections" => {
            let sections = parse_sections(content_md);
            json!(sections.iter().map(|s| json!({ "heading": s.heading, "level": s.level })).collect::<Vec<_>>())
        }
        "read_section" => {
            let target = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let sections = parse_sections(content_md);
            let found = sections.iter().find(|s| s.heading.eq_ignore_ascii_case(target));
            match found {
                Some(s) => json!({ "heading": s.heading, "body": s.body }),
                None => json!({ "error": format!("no section named '{target}'") }),
            }
        }
        "read_full" => json!({ "content": content_md }),
        "list_components" => {
            // Extract <ComponentName ...> occurrences.
            let mut comps = Vec::new();
            for line in content_md.lines() {
                let t = line.trim();
                if t.starts_with('<') {
                    if let Some(name) = t.strip_prefix('<').and_then(|rest| rest.split(|c: char| !c.is_alphanumeric()).next()) {
                        if !name.is_empty() && name.chars().next().map_or(false, |c| c.is_uppercase()) {
                            comps.push(json!({ "name": name, "jsx": t }));
                        }
                    }
                }
            }
            json!(comps)
        }
        "get_metadata" => json!({
            "version": manifest.version,
            "origin_domain": manifest.origin_domain,
            "capabilities": manifest.capabilities.len(),
            "signed": manifest.signature.is_some()
        }),
        "vault.remember" => {
            // Deposit a memory as a new .mdxz note in vault/Memories/.
            let title = params.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled memory");
            let content = params.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let source = params.get("source").and_then(|v| v.as_str()).unwrap_or("unknown");
            let tags: Vec<String> = params.get("tags")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|t| t.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let vault = match vault_path {
                Some(p) => p,
                None => return json!({ "error": "no vault path available (run with a vault)" }),
            };
            let memories_dir = vault.join("Memories");
            let _ = std::fs::create_dir_all(&memories_dir);
            // Sanitize title → filename.
            let safe: String = title.chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { ' ' }).collect::<String>().trim().to_string();
            let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
            let filename = format!("{}-{}.mdxz", if safe.is_empty() { "memory" } else { &safe }, timestamp);
            let path = memories_dir.join(&filename);
            let note_content = format!(
                "# {title}\n\n**Source:** {source}  \n**Tags:** {}  \n**Deposited:** {}\n\n---\n\n{content}\n",
                tags.join(", "),
                chrono_like(timestamp),
            );
            let m = Manifest {
                version: "0.1.0".into(),
                origin_domain: Some("agent-memory".into()),
                capabilities: vec![],
                signature: None,
            };
            match crate::save::save_document(&path, &note_content, "return { default: () => null }", &m) {
                Ok(_) => json!({ "ok": true, "path": path.to_string_lossy(), "title": title }),
                Err(e) => json!({ "error": format!("could not save memory: {e}") }),
            }
        }
        _ => json!({ "error": format!("unknown tool: {name}") }),
    }
}

/// Minimal human-readable timestamp without pulling chrono (avoids a dep).
fn chrono_like(secs: u64) -> String {
    // Good enough for a label; not timezone-aware.
    let days = secs / 86400;
    let year = 1970 + (days / 365); // approximate
    format!("epoch+{secs}s (~{year})")
}

/// Run the MCP server against a doc path. Reads line-delimited JSON-RPC from
/// `reader`, writes responses to `writer`. Returns on EOF.
pub fn run<R: BufRead, W: Write>(
    reader: R,
    mut writer: W,
    doc_path: &Path,
) -> Result<(), McpError> {
    let contents = package::open_package(doc_path)?;
    let content_md = &contents.content_md;
    let manifest = &contents.manifest;

    let send = |w: &mut W, id: &Option<Value>, result: Value| -> Result<(), McpError> {
        let resp = json!({ "jsonrpc": "2.0", "id": id, "result": result });
        writeln!(w, "{}", resp)?;
        w.flush()?;
        Ok(())
    };

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break, // EOF / error → stop
        };
        if line.trim().is_empty() {
            continue;
        }
        let req: RpcRequest = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(e) => {
                let _ = writeln!(writer, r#"{{"jsonrpc":"2.0","id":null,"error":{{"code":-32700,"message":"Parse error: {e}"}}}}"#);
                let _ = writer.flush();
                continue;
            }
        };
        match req.method.as_str() {
            "initialize" => {
                send(&mut writer, &req.id, json!({
                    "protocolVersion": "2024-11-05",
                    "serverInfo": { "name": "prizmapage", "version": env!("CARGO_PKG_VERSION") },
                    "capabilities": { "tools": {} }
                }))?;
            }
            "initialized" | "notifications/initialized" => {
                // No response needed for notifications.
            }
            "tools/list" => {
                send(&mut writer, &req.id, json!({ "tools": tools_list() }))?;
            }
            "tools/call" => {
                let tool_name = req.params.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let args = req.params.get("arguments").cloned().unwrap_or(json!({}));
                let result = handle_tool(tool_name, &args, content_md, manifest, doc_path.parent());
                send(&mut writer, &req.id, json!({
                    "content": [{ "type": "text", "text": result.to_string() }]
                }))?;
            }
            _ => {
                let _ = send(&mut writer, &req.id, json!({ "error": { "code": -32601, "message": format!("method not found: {}", req.method) } }));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn sample_md() -> &'static str {
        "# Title\n\nIntro paragraph.\n\n## First\n\nBody of first.\n\n## Second\n\nBody of second.\n"
    }

    #[test]
    fn parse_sections_splits_on_headings() {
        let s = parse_sections(sample_md());
        assert_eq!(s.len(), 3);
        assert_eq!(s[0].heading, "Title");
        assert_eq!(s[0].level, 1);
        assert!(s[0].body.contains("Intro paragraph"));
        assert_eq!(s[1].heading, "First");
        assert_eq!(s[2].heading, "Second");
    }

    #[test]
    fn parse_sections_handles_no_headings() {
        let s = parse_sections("just prose\nmore prose\n");
        assert_eq!(s.len(), 1);
        assert_eq!(s[0].heading, "(intro)");
    }

    #[test]
    fn parse_sections_empty_doc() {
        let s = parse_sections("");
        assert!(s.is_empty());
    }

    // The `run` function requires a real .mdxz on disk (open_package). We test
    // the JSON-RPC dispatch logic indirectly via the helpers above; a full
    // integration test would write a fixture .mdxz and run against it.
    #[test]
    fn handle_tool_list_sections() {
        let md = sample_md();
        let manifest = Manifest { version: "0.1.0".into(), origin_domain: Some("test".into()), capabilities: vec![], signature: None };
        let v = handle_tool("list_sections", &json!({}), md, &manifest, None);
        let arr = v.as_array().unwrap();
        assert_eq!(arr.len(), 3);
    }

    #[test]
    fn handle_tool_read_section_finds_by_name() {
        let md = sample_md();
        let manifest = Manifest { version: "0.1.0".into(), origin_domain: Some("test".into()), capabilities: vec![], signature: None };
        let v = handle_tool("read_section", &json!({"name": "First"}), md, &manifest, None);
        assert!(v["body"].as_str().unwrap().contains("Body of first"));
    }

    #[test]
    fn handle_tool_read_section_missing_returns_error() {
        let md = sample_md();
        let manifest = Manifest { version: "0.1.0".into(), origin_domain: Some("test".into()), capabilities: vec![], signature: None };
        let v = handle_tool("read_section", &json!({"name": "nope"}), md, &manifest, None);
        assert!(v["error"].as_str().unwrap().contains("no section"));
    }

    #[test]
    fn handle_tool_list_components_extracts_jsx() {
        let md = "# Doc\n\n<StatCard label=\"X\" />\n\ntext\n\n<Callout type=\"info\">hi</Callout>\n";
        let manifest = Manifest { version: "0.1.0".into(), origin_domain: Some("test".into()), capabilities: vec![], signature: None };
        let v = handle_tool("list_components", &json!({}), md, &manifest, None);
        let arr = v.as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0]["name"], "StatCard");
        assert_eq!(arr[1]["name"], "Callout");
    }

    #[test]
    fn handle_tool_unknown_returns_error() {
        let manifest = Manifest { version: "0.1.0".into(), origin_domain: Some("test".into()), capabilities: vec![], signature: None };
        let v = handle_tool("bogus", &json!({}), "x", &manifest, None);
        assert!(v["error"].as_str().unwrap().contains("unknown tool"));
    }

    #[test]
    fn vault_remember_writes_a_note_to_memories_folder() {
        use tempfile::tempdir;
        let dir = tempdir().unwrap();
        let vault = dir.path();
        let manifest = Manifest { version: "0.1.0".into(), origin_domain: Some("test".into()), capabilities: vec![], signature: None };
        let params = json!({ "title": "Insight about X", "content": "X is related to Y", "source": "claude-code", "tags": ["research"] });
        let v = handle_tool("vault.remember", &params, "doc text", &manifest, Some(vault));
        assert_eq!(v["ok"], true);
        let path = v["path"].as_str().unwrap();
        assert!(path.contains("Memories"));
        assert!(path.contains("Insight about X"));
        // The note was actually written.
        assert!(std::path::Path::new(path).exists());
        let contents = crate::package::open_package(std::path::Path::new(path)).unwrap();
        assert!(contents.content_md.contains("Insight about X"));
        assert!(contents.content_md.contains("claude-code"));
    }

    #[test]
    fn vault_remember_without_vault_returns_error() {
        let manifest = Manifest { version: "0.1.0".into(), origin_domain: Some("test".into()), capabilities: vec![], signature: None };
        let v = handle_tool("vault.remember", &json!({ "title": "x", "content": "y" }), "doc", &manifest, None);
        assert!(v["error"].as_str().unwrap().contains("no vault"));
    }

    #[test]
    fn run_handles_initialize_and_tools_list_against_a_real_package() {
        // Write a minimal .mdxz to a temp file, then run the JSON-RPC loop.
        let tmp = std::env::temp_dir().join("prizma_mcp_test.mdxz");
        let manifest = Manifest { version: "0.1.0".into(), origin_domain: Some("test".into()), capabilities: vec![], signature: None };
        crate::save::save_document(&tmp, "# Hello\n\nWorld.\n", "return { default: () => null }", &manifest).unwrap();

        let input = "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\"}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}\n";
        let reader = Cursor::new(input);
        let mut output = Vec::new();
        run(reader, &mut output, &tmp).unwrap();
        let out = String::from_utf8(output).unwrap();
        // Two response lines.
        let lines: Vec<&str> = out.lines().filter(|l| !l.is_empty()).collect();
        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("prizmapage"));
        assert!(lines[1].contains("list_sections"));
        let _ = std::fs::remove_file(&tmp);
    }
}
