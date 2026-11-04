import { describe, it, expect, beforeEach } from "vitest";
import { registerComponent, getComponent, listComponents, resetRegistry } from "./ComponentRegistry";

describe("ComponentRegistry", () => {
  beforeEach(() => resetRegistry());

  it("registers and retrieves a component", () => {
    registerComponent({
      name: "TestComp",
      label: "Test Comp",
      icon: "🧪",
      category: "component",
      insertTemplate: () => '<TestComp label="x" />',
      defaultProps: { label: "x" },
      render: () => null,
    });
    const def = getComponent("TestComp");
    expect(def?.label).toBe("Test Comp");
  });

  it("returns undefined for unknown components", () => {
    expect(getComponent("DoesNotExist")).toBeUndefined();
  });

  it("lists components grouped by category", () => {
    registerComponent({
      name: "A",
      label: "A",
      icon: "1",
      category: "component",
      insertTemplate: () => "<A />",
      defaultProps: {},
      render: () => null,
    });
    registerComponent({
      name: "H2",
      label: "Heading 2",
      icon: "h",
      category: "prose",
      insertTemplate: () => "## ",
      defaultProps: {},
      render: () => null,
    });
    const all = listComponents();
    expect(all.map((c) => c.name)).toEqual(expect.arrayContaining(["A", "H2"]));
    const components = all.filter((c) => c.category === "component");
    expect(components.map((c) => c.name)).toEqual(["A"]);
  });
});
