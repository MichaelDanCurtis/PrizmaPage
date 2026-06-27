interface Props { words: number; goal: number; onSetGoal: () => void; }

export function GoalBar({ words, goal, onSetGoal }: Props) {
  if (!goal || goal <= 0) return null;
  const pct = Math.min(100, Math.round((words / goal) * 100));
  const reached = words >= goal;
  return (
    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 14px", fontSize: 11, color: "var(--text-faint)", background: "var(--bg)", fontFamily: "var(--font-sans)" }}>
      <span title="Set goal" onClick={onSetGoal} style={{ cursor: "pointer", textDecoration: "underline dotted" }}>
        {reached ? "🎯 Goal reached" : `${words} / ${goal}`}
      </span>
      <div style={{ flex: 1, maxWidth: 120, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: reached ? "#059669" : "var(--accent)", transition: "width 150ms" }} />
      </div>
    </div>
  );
}
