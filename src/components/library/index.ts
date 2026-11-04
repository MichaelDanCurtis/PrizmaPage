import { registerComponent } from "../../registry/ComponentRegistry";
import { Callout } from "./Callout";
import { StatCard } from "./StatCard";
import { CodeBlock } from "./CodeBlock";
import { Divider } from "./Divider";
import { Table } from "./Table";
import { Chart } from "./Chart";
import { Badge } from "./Badge";
import { FeatureCard, StatGroup } from "./StatGroup";
import { Tabs } from "./Tabs";
import { Quote } from "./Quote";
import { Diagram } from "./Diagram";
import { D2 } from "./D2";
import { Drawio } from "./Drawio";

let registered = false;

/// Register all built-in components. Idempotent — safe to call from app init.
export function registerLibrary(): void {
  if (registered) return;
  registered = true;

  // ===== Starter set (Layer 2a) =====
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

  // ===== Layer 2b: comprehensive library =====
  registerComponent({
    name: "Table",
    label: "Table",
    icon: "▦",
    category: "component",
    insertTemplate: () =>
      `<Table data="{&quot;headers&quot;:[&quot;A&quot;,&quot;B&quot;],&quot;rows&quot;:[[&quot;1&quot;,&quot;2&quot;],[&quot;3&quot;,&quot;4&quot;]]}" />`,
    defaultProps: {},
    render: Table,
  });

  registerComponent({
    name: "Chart",
    label: "Chart",
    icon: "📊",
    category: "component",
    insertTemplate: () =>
      `<Chart title="Sales" data="[{&quot;label&quot;:&quot;Q1&quot;,&quot;value&quot;:4},{&quot;label&quot;:&quot;Q2&quot;,&quot;value&quot;:7}]" />`,
    defaultProps: {},
    render: Chart,
  });

  registerComponent({
    name: "Badge",
    label: "Badge",
    icon: "🏷️",
    category: "component",
    insertTemplate: () => '<Badge label="New" color="accent" />',
    defaultProps: { label: "New", color: "accent" },
    render: Badge,
  });

  registerComponent({
    name: "FeatureCard",
    label: "FeatureCard",
    icon: "🗂️",
    category: "component",
    insertTemplate: () => '<FeatureCard title="Feature" emoji="✨">Describe the feature here.</FeatureCard>',
    defaultProps: { title: "Feature", emoji: "✨" },
    render: FeatureCard,
  });

  registerComponent({
    name: "StatGroup",
    label: "StatGroup",
    icon: "📈",
    category: "component",
    insertTemplate: () =>
      `<StatGroup stats="[{&quot;label&quot;:&quot;Users&quot;,&quot;value&quot;:&quot;1.2k&quot;},{&quot;label&quot;:&quot;Revenue&quot;,&quot;value&quot;:&quot;$3.4k&quot;}]" />`,
    defaultProps: {},
    render: StatGroup,
  });

  registerComponent({
    name: "Tabs",
    label: "Tabs",
    icon: "🗂",
    category: "component",
    insertTemplate: () =>
      `<Tabs tabs="[{&quot;label&quot;:&quot;Overview&quot;,&quot;body&quot;:&quot;Overview content.&quot;},{&quot;label&quot;:&quot;Details&quot;,&quot;body&quot;:&quot;Details content.&quot;}]" />`,
    defaultProps: {},
    render: Tabs,
  });

  registerComponent({
    name: "Quote",
    label: "Quote",
    icon: "❝",
    category: "component",
    insertTemplate: () => '<Quote author="Author">A memorable pull-quote.</Quote>',
    defaultProps: { author: "Author" },
    render: Quote,
  });

  // ===== Layer 4: multi-format rendering (render-only) =====
  registerComponent({
    name: "Diagram",
    label: "Diagram",
    icon: "🔀",
    category: "component",
    // Mermaid source stored as children text. Multi-line diagrams are supported
    // by the serializer's multi-line open/close path.
    insertTemplate: () => "<Diagram>graph TD\nA-->B\nB-->C</Diagram>",
    defaultProps: {},
    render: Diagram,
  });

  registerComponent({
    name: "D2",
    label: "D2",
    icon: "🔲",
    category: "component",
    insertTemplate: () => "<D2>x -> y\ny -> z</D2>",
    defaultProps: {},
    render: D2,
  });

  registerComponent({
    name: "Drawio",
    label: "Drawio",
    icon: "📊",
    category: "component",
    insertTemplate: () => "<Drawio>&lt;mxfile&gt;&lt;diagram&gt;&lt;mxGraphModel&gt;&lt;root&gt;&lt;mxCell value=\"Hello\" style=\"ellipse;\" vertex=\"1\"/&gt;&lt;/root&gt;&lt;/mxGraphModel&gt;&lt;/diagram&gt;&lt;/mxfile&gt;</Drawio>",
    defaultProps: {},
    render: Drawio,
  });
}

/// Exported for tests / external registration.
export {
  Callout, StatCard, CodeBlock, Divider, Table, Chart, Badge,
  FeatureCard, StatGroup, Tabs, Quote, Diagram, D2, Drawio,
};
