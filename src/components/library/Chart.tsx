import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

/// A self-contained SVG bar chart. No external chart lib — keeps the bundle
/// tiny and the component fully deterministic for the viewer's sandbox.
///
/// `data` is a JSON string of `[{ label: string, value: number }]`.
interface Bar {
  label: string;
  value: number;
}

interface ChartProps extends ComponentProps {
  data?: string; // JSON: [{label, value}]
  title?: string;
}

function parseBars(data: string | undefined): Bar[] {
  if (!data) return [{ label: "A", value: 4 }, { label: "B", value: 7 }, { label: "C", value: 3 }];
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.every((b) => "label" in b && "value" in b)) {
      return parsed as Bar[];
    }
  } catch {
    /* fall through */
  }
  return [{ label: "A", value: 4 }, { label: "B", value: 7 }, { label: "C", value: 3 }];
}

export const Chart: FC<ChartProps> = ({ data, title }) => {
  const bars = parseBars(data);
  const max = Math.max(...bars.map((b) => b.value), 1);
  const W = 360;
  const H = 160;
  const pad = { top: 16, right: 12, bottom: 28, left: 32 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const barW = plotW / bars.length;

  return (
    <div
      style={{
        background: "var(--bg-muted)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 14,
        margin: "12px 0",
      }}
    >
      {title && (
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "var(--text)" }}>
          {title}
        </div>
      )}
      <svg width={W} height={H} role="img" aria-label={title || "bar chart"}>
        {/* y-axis baseline */}
        <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="var(--border)" />
        {bars.map((b, i) => {
          const h = (b.value / max) * plotH;
          const x = pad.left + i * barW + barW * 0.15;
          const y = pad.top + plotH - h;
          const w = barW * 0.7;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="var(--accent)" rx={2} />
              <text
                x={x + w / 2}
                y={pad.top + plotH + 14}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-muted)"
                fontFamily="var(--font-sans)"
              >
                {b.label}
              </text>
              <text
                x={x + w / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-muted)"
                fontFamily="var(--font-sans)"
              >
                {b.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
