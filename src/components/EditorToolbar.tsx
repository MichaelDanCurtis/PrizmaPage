import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { listComponents } from "../registry/ComponentRegistry";
import { LANGUAGES } from "../lib/languages";

interface Props {
  editor: Editor | null;
  onInsert: (template: string) => void;
  onInsertImage: () => void;
  spellcheck?: boolean;
  onToggleSpellcheck?: () => void;
  onOpenTemplates?: () => void;
}

/// One toolbar button with optional active state.
function TBtn({
  label,
  title,
  active,
  disabled,
  onClick,
}: {
  label: React.ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-muted)",
        border: "none",
        padding: "4px 8px",
        borderRadius: "var(--radius-sm)",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-sans)",
        minWidth: 28,
        opacity: disabled ? 0.4 : 1,
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = active ? "var(--accent-soft)" : "var(--bg-muted)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = active ? "var(--accent-soft)" : "transparent";
      }}
    >
      {label}
    </button>
  );
}

/// A dropdown subtool — click the trigger, a flyout appears below.
function Dropdown({
  trigger,
  children,
  align = "left",
}: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <TBtn label={trigger} title="" onClick={() => setOpen((v) => !v)} active={open} />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            [align]: 0,
            marginTop: 4,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 4,
            zIndex: 200,
            minWidth: 160,
          }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/// A flyout menu row.
function MenuRow({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: string;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "5px 10px",
        cursor: "pointer",
        borderRadius: "var(--radius-sm)",
        display: "flex",
        gap: 8,
        alignItems: "center",
        fontSize: 12,
        color: label.includes("AI") ? "var(--accent)" : "var(--text)",
        fontWeight: label.includes("AI") ? 500 : 400,
        fontFamily: "var(--font-sans)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ width: 16, textAlign: "center", fontSize: 12 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && <span style={{ color: "var(--text-faint)", fontSize: 10 }}>{shortcut}</span>}
    </div>
  );
}

const DIVIDER_STYLE: React.CSSProperties = {
  width: 1,
  background: "var(--border)",
  height: 20,
  margin: "0 2px",
  flexShrink: 0,
};

export function EditorToolbar({ editor, onInsert, onInsertImage, spellcheck = true, onToggleSpellcheck, onOpenTemplates }: Props) {
  const components = listComponents().filter((c) => c.category === "component");

  if (!editor) {
    return (
      <div
        style={{
          padding: "4px 12px",
          display: "flex",
          alignItems: "center",
          gap: 2,
          borderBottom: "1px solid var(--border-soft)",
          background: "var(--bg)",
          height: 34,
        }}
      />
    );
  }

  return (
    <div
      style={{
        padding: "4px 12px",
        display: "flex",
        alignItems: "center",
        gap: 2,
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--bg)",
        minHeight: 34,
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Text type dropdown */}
      <Dropdown
        trigger={
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {editor.isActive("heading", { level: 2 })
              ? "H₂"
              : editor.isActive("heading", { level: 3 })
              ? "H₃"
              : "Text"}
            <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
          </span>
        }
      >
        {(close) => (
          <>
            <MenuRow
              icon="¶"
              label="Normal text"
              onClick={() => {
                editor.chain().focus().setParagraph().run();
                close();
              }}
            />
            <MenuRow
              icon="H₂"
              label="Heading 2"
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
                close();
              }}
            />
            <MenuRow
              icon="H₃"
              label="Heading 3"
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 3 }).run();
                close();
              }}
            />
          </>
        )}
      </Dropdown>

      <div style={DIVIDER_STYLE} />

      {/* Inline formatting */}
      <TBtn
        label={<strong>B</strong>}
        title="Bold (Cmd+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <TBtn
        label={<em>I</em>}
        title="Italic (Cmd+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <TBtn
        label={<code style={{ fontSize: 11 }}>{"</>"}</code>}
        title="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />

      {/* Rich formatting: underline, strike, color, highlight */}
      <TBtn
        label="U"
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <TBtn
        label="S"
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <TBtn
        label="X₂"
        title="Subscript"
        active={editor.isActive("subscript")}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
      />
      <TBtn
        label="X²"
        title="Superscript"
        active={editor.isActive("superscript")}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
      />
      <label title="Text color" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>A</span>
        <input
          type="color"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          style={{ width: 18, height: 18, border: "none", background: "none", padding: 0, marginLeft: 2 }}
        />
      </label>
      <label title="Highlight" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        <span style={{ fontSize: 12 }}>🖊</span>
        <input
          type="color"
          onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          style={{ width: 18, height: 18, border: "none", background: "none", padding: 0, marginLeft: 2 }}
        />
      </label>

      <div style={DIVIDER_STYLE} />

      {/* Alignment */}
      <TBtn label="≡" title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
      <TBtn label="≣" title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
      <TBtn label="≡̶" title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} />

      <div style={DIVIDER_STYLE} />

      {/* Link + image */}
      <TBtn
        label="🔗"
        title="Add link"
        onClick={() => {
          const url = window.prompt("Link URL");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
      />
      <TBtn label="🖼" title="Insert image" onClick={onInsertImage} />

      <div style={DIVIDER_STYLE} />

      {/* List dropdown */}
      <Dropdown
        trigger={
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            ☰
            <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
          </span>
        }
      >
        {(close) => (
          <>
            <MenuRow
              icon="•"
              label="Bulleted list"
              onClick={() => {
                editor.chain().focus().toggleBulletList().run();
                close();
              }}
            />
            <MenuRow
              icon="1."
              label="Numbered list"
              onClick={() => {
                editor.chain().focus().toggleOrderedList().run();
                close();
              }}
            />
            <MenuRow
              icon="☐"
              label="Checklist"
              onClick={() => {
                editor.chain().focus().toggleTaskList().run();
                close();
              }}
            />
          </>
        )}
      </Dropdown>

      <TBtn
        label='"'
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />

      {/* Table controls — only when the cursor is inside a table. */}
      {editor.isActive("table") && (
        <>
          <div style={DIVIDER_STYLE} />
          <TBtn label="↧ row" title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()} />
          <TBtn label="↦ col" title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()} />
          <TBtn label="☰" title="Toggle header row" active={editor.isActive("tableHeader")} onClick={() => editor.chain().focus().toggleHeaderRow().run()} />
          <TBtn label="🗑" title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()} />
          <div style={DIVIDER_STYLE} />
        </>
      )}

      {/* CodeBlock language picker — only when a CodeBlock component is selected. */}
      {editor.isActive("component") && (() => {
        // Find the selected CodeBlock component node + its current language.
        const { $from } = editor.state.selection;
        let codeNode: { pos: number; lang: string; attrs: Record<string, unknown> } | null = null;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === "component" && node.attrs?._name === "CodeBlock") {
            codeNode = { pos: $from.before(d), lang: String(node.attrs?.language ?? "text"), attrs: { ...(node.attrs as object) } };
            break;
          }
        }
        if (!codeNode) return null;
        return (
          <>
            <div style={DIVIDER_STYLE} />
            <label title="Code language" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
              lang
              <select
                value={codeNode.lang}
                onChange={(e) => {
                  const pos = codeNode!.pos;
                  const newAttrs = { ...codeNode!.attrs, language: e.target.value };
                  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, newAttrs));
                  editor.chain().focus().run();
                }}
                style={{ fontSize: 11, padding: "2px 4px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)" }}
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <div style={DIVIDER_STYLE} />
          </>
        );
      })()}

      <div style={DIVIDER_STYLE} />

      {/* Insert dropdown — components + AI */}
      <Dropdown
        trigger={
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            ✦ Insert
            <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
          </span>
        }
      >
        {(close) => (
          <>
            <div
              style={{
                color: "var(--text-faint)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 1,
                fontSize: 9,
                padding: "4px 8px 2px",
              }}
            >
              Components
            </div>
            {components.map((c) => (
              <MenuRow
                key={c.name}
                icon={c.icon}
                label={c.label}
                onClick={() => {
                  onInsert(c.insertTemplate());
                  close();
                }}
              />
            ))}
            <MenuRow
              icon="⎌"
              label="Divider"
              onClick={() => {
                onInsert("<Divider />");
                close();
              }}
            />
            <MenuRow
              icon="⊞"
              label="Table"
              onClick={() => {
                editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
                close();
              }}
            />
            <div
              style={{
                borderTop: "1px solid var(--border-soft)",
                marginTop: 4,
                paddingTop: 4,
              }}
            />
            <MenuRow
              icon="✨"
              label="AI component…"
              onClick={() => {
                onInsert(""); // empty template signals the AI dialog (EditorView)
                close();
              }}
            />
            {onOpenTemplates && (
              <MenuRow
                icon="📋"
                label="Templates…"
                onClick={() => {
                  onOpenTemplates();
                  close();
                }}
              />
            )}
          </>
        )}
      </Dropdown>

      {/* Divider quick button */}
      <TBtn
        label="⎌"
        title="Divider"
        onClick={() => onInsert("<Divider />")}
      />

      {/* Undo / Redo */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
        <TBtn
          label="✓ABC"
          title={spellcheck ? "Spellcheck on — click to turn off" : "Spellcheck off — click to turn on"}
          active={spellcheck}
          onClick={() => onToggleSpellcheck?.()}
        />
        <TBtn
          label="↶"
          title="Undo (Cmd+Z)"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <TBtn
          label="↷"
          title="Redo (Cmd+Shift+Z)"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
    </div>
  );
}
