import { describe, it, expect } from "vitest";
import { topoOrder, upstreamOf, nodeTypeDef, NODE_TYPES, type Workflow } from "./workflow";

describe("workflow model", () => {
  it("NODE_TYPES has the 6 specced node types", () => {
    const types = NODE_TYPES.map((t) => t.type);
    expect(types).toContain("trigger");
    expect(types).toContain("ai");
    expect(types).toContain("create-doc");
    expect(types).toContain("store");
    expect(types).toContain("notify");
    expect(types).toContain("mcp-call");
  });

  it("nodeTypeDef returns the def with paramFields", () => {
    const def = nodeTypeDef("ai");
    expect(def.label).toBe("AI step");
    expect(def.paramFields.some((p) => p.key === "prompt")).toBe(true);
  });

  it("topoOrder orders a linear chain trigger → ai → store", () => {
    const wf: Workflow = {
      nodes: [
        { id: "store", type: "store", x: 0, y: 0, params: {} },
        { id: "trigger", type: "trigger", x: 0, y: 0, params: {} },
        { id: "ai", type: "ai", x: 0, y: 0, params: {} },
      ],
      edges: [
        { from: "trigger", to: "ai" },
        { from: "ai", to: "store" },
      ],
    };
    expect(topoOrder(wf)).toEqual(["trigger", "ai", "store"]);
  });

  it("topoOrder handles a diamond (branch + merge)", () => {
    const wf: Workflow = {
      nodes: [
        { id: "a", type: "trigger", x: 0, y: 0, params: {} },
        { id: "b", type: "ai", x: 0, y: 0, params: {} },
        { id: "c", type: "ai", x: 0, y: 0, params: {} },
        { id: "d", type: "store", x: 0, y: 0, params: {} },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "d" },
        { from: "c", to: "d" },
      ],
    };
    const order = topoOrder(wf);
    expect(order[0]).toBe("a"); // trigger first
    expect(order[3]).toBe("d"); // store last
    expect(order.includes("b")).toBe(true);
    expect(order.includes("c")).toBe(true);
  });

  it("upstreamOf returns the source node of the edge into a node", () => {
    const wf: Workflow = {
      nodes: [
        { id: "a", type: "trigger", x: 0, y: 0, params: {} },
        { id: "b", type: "ai", x: 0, y: 0, params: {} },
      ],
      edges: [{ from: "a", to: "b" }],
    };
    expect(upstreamOf(wf, "b")?.id).toBe("a");
    expect(upstreamOf(wf, "a")).toBeNull();
  });

  it("topoOrder includes all nodes even with a cycle", () => {
    const wf: Workflow = {
      nodes: [
        { id: "a", type: "ai", x: 0, y: 0, params: {} },
        { id: "b", type: "ai", x: 0, y: 0, params: {} },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    };
    const order = topoOrder(wf);
    expect(order).toHaveLength(2);
    expect(order.includes("a")).toBe(true);
    expect(order.includes("b")).toBe(true);
  });
});
