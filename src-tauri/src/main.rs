#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{stdin, stdout};

fn main() {
    // CLI mode: `prizmapage mcp-server --doc <path>` runs the document as an
    // MCP server (JSON-RPC over stdio). Otherwise, launch the Tauri app.
    let args: Vec<String> = std::env::args().collect();
    if args.len() >= 2 && args[1] == "mcp-server" {
        let doc_path = args.iter().position(|a| a == "--doc")
            .and_then(|i| args.get(i + 1))
            .expect("mcp-server requires --doc <path>");
        let path = std::path::PathBuf::from(doc_path);
        if let Err(e) = prizmapage::mcp_server::run(stdin().lock(), stdout(), &path) {
            eprintln!("mcp-server error: {e}");
            std::process::exit(1);
        }
        return;
    }
    prizmapage::run()
}
