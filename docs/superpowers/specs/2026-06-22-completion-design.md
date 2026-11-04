# Inline Code Completion — Design

> **Roadmap position:** Sub-project 7 of 7 (Phase 7 polish).

## 1. Goal

Inline AI completion in the editor: as the author pauses typing, the editor requests a short completion of the current paragraph tail from the configured provider and shows it as a floating greyed hint near the cursor. **Tab** accepts (inserts); any other key dismisses.

## 2. Approach (floating-hint, not ProseMirror decoration)

A full ghost-text decoration inside ProseMirror is complex and fragile. The pragmatic v1 uses a **floating hint widget**:
- After a 800ms typing debounce (and only if a provider is configured), the editor sends the current paragraph's text to a new `ai_complete_inline` Rust command (system prompt: "complete the sentence; return ONLY the continuation, no preamble").
- The frontend shows a small floating `<div>` at the cursor's screen position with the suggestion in grey, prefixed "Tab↹".
- `Tab` inserts the suggestion at the cursor and hides the hint; any keystroke or cursor move hides it.

This is the Copilot-style affordance without the decoration subsystem's risk.

## 3. Files

- Rust: `ai_complete_inline` command (mirrors `ai_generate_document`, shorter system prompt, max ~60 tokens).
- Frontend: `useInlineCompletion` hook (debounce + request + suggestion state), `CompletionHint.tsx` (floating widget), wired into WysiwygSurface.
- Mock: `ai_complete_inline` returns a short continuation.

## 4. Non-goals

- Full ProseMirror ghost-text decoration (floating hint is v1).
- Multi-line completions (single sentence tail).
- Completion of component JSX (prose only).
