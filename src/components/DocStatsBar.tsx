import type { DocStats } from "../lib/docStats";

interface Props {
  stats: DocStats;
  selectionStats: DocStats | null;
}

export function DocStatsBar({ stats, selectionStats }: Props) {
  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        gap: 16,
        padding: "4px 14px",
        fontSize: 11,
        color: "var(--text-faint)",
        background: "var(--bg)",
        borderTop: "1px solid var(--border-soft)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <span>{stats.words} words</span>
      <span>{stats.characters} characters</span>
      <span>{stats.readingMinutes === 0 ? "<1" : stats.readingMinutes} min read</span>
      {selectionStats && (
        <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
          selected: {selectionStats.words} words
        </span>
      )}
    </div>
  );
}
