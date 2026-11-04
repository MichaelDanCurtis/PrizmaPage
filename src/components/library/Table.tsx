import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

/// A simple data table component.
///
/// The `data` attribute is a JSON string of `{ headers: string[], rows: string[][] }`.
/// Keeping it a JSON string lets it round-trip through the generic component
/// node's `_jsx` attr (which stores attrs as `key="value"` pairs) without
/// needing a richer storage model.
interface TableData {
  headers: string[];
  rows: string[][];
}

interface TableProps extends ComponentProps {
  data?: string; // JSON string of TableData
}

function parseData(data: string | undefined): TableData {
  if (!data) return { headers: ["A", "B", "C"], rows: [["1", "2", "3"]] };
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed.headers) && Array.isArray(parsed.rows)) return parsed;
  } catch {
    /* fall through to default */
  }
  return { headers: ["A", "B", "C"], rows: [["1", "2", "3"]] };
}

export const Table: FC<TableProps> = ({ data }) => {
  const { headers, rows } = parseData(data);
  return (
    <div style={{ overflowX: "auto", margin: "12px 0" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          font: "var(--font-body)",
        }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-muted)",
                  padding: "8px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    border: "1px solid var(--border)",
                    padding: "8px 12px",
                    color: "var(--text)",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
