import { useState } from "react";
import type { DocStats } from "../lib/docStats";
import type { Readability } from "../lib/readability";

interface Props {
  stats: DocStats;
  selectionStats: DocStats | null;
  readability: Readability | null;
}

export function DocStatsBar({ stats, selectionStats, readability }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  return (
    <div
      className="no-print"
      style={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      <div style={{ display: "flex", gap: 16, padding: "4px 14px", fontSize: 11, color: "var(--text-faint)", background: "var(--bg)", borderTop: "1px solid var(--border-soft)", fontFamily: "var(--font-sans)" }}>
        <span>{stats.words} words</span>
        <span>{stats.characters} characters</span>
        <span>{stats.readingMinutes === 0 ? "<1" : stats.readingMinutes} min read</span>
        <span onClick={() => setShowDetail((v) => !v)} title="Readability statistics" style={{ marginLeft: "auto", cursor: "pointer", textDecoration: "underline dotted" }}>
          {showDetail ? "▾ details" : "▸ details"}
        </span>
        {selectionStats && (
          <span style={{ color: "var(--text-muted)" }}>
            selected: {selectionStats.words} words
          </span>
        )}
      </div>
      {showDetail && readability && (
        <div style={{ display: "flex", gap: 16, padding: "2px 14px 6px", fontSize: 11, color: "var(--text-muted)", background: "var(--bg)", fontFamily: "var(--font-sans)", flexWrap: "wrap" }}>
          <span>{readability.sentences} sentences</span>
          <span>avg word length: {readability.avgWordLength}</span>
          <span>reading ease: {readability.fleschScore}</span>
          {readability.topWords.length > 0 && (
            <span>top: {readability.topWords.slice(0, 5).map((w) => `${w.word}(${w.count})`).join(" ")}</span>
          )}
        </div>
      )}
    </div>
  );
}
