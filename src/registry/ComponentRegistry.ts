import type { FC } from "react";

export interface ComponentProps {
  [key: string]: unknown;
}

export interface ComponentDefinition {
  name: string; // "StatCard" — used in <StatCard /> in MDX
  label: string; // "StatCard" — shown in menus
  icon: string; // emoji or short string for the slash/+ menu
  category: "prose" | "component";
  insertTemplate: () => string; // MDX to insert
  defaultProps: Record<string, unknown>;
  render: FC<ComponentProps>;
}

const registry = new Map<string, ComponentDefinition>();

export function registerComponent(def: ComponentDefinition): void {
  registry.set(def.name, def);
}

export function getComponent(name: string): ComponentDefinition | undefined {
  return registry.get(name);
}

export function listComponents(): ComponentDefinition[] {
  return Array.from(registry.values());
}

export function resetRegistry(): void {
  registry.clear();
}
