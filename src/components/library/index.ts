import { registerComponent } from "../../registry/ComponentRegistry";
import { Callout } from "./Callout";
import { StatCard } from "./StatCard";
import { CodeBlock } from "./CodeBlock";
import { Divider } from "./Divider";

let registered = false;

/// Register all starter components. Idempotent — safe to call from app init.
export function registerLibrary(): void {
  if (registered) return;
  registered = true;

  registerComponent({
    name: "Callout",
    label: "Callout",
    icon: "💬",
    category: "component",
    insertTemplate: () => '<Callout type="info">New callout</Callout>',
    defaultProps: { type: "info" },
    render: Callout,
  });

  registerComponent({
    name: "StatCard",
    label: "StatCard",
    icon: "🔢",
    category: "component",
    insertTemplate: () => '<StatCard label="Label" value="Value" />',
    defaultProps: { label: "Label", value: "Value" },
    render: StatCard,
  });

  registerComponent({
    name: "CodeBlock",
    label: "CodeBlock",
    icon: "⌨️",
    category: "component",
    insertTemplate: () => '<CodeBlock language="ts">// code</CodeBlock>',
    defaultProps: { language: "ts" },
    render: CodeBlock,
  });

  registerComponent({
    name: "Divider",
    label: "Divider",
    icon: "⎌",
    category: "component",
    insertTemplate: () => "<Divider />",
    defaultProps: {},
    render: Divider,
  });
}
