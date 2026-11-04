import { describe, it, expect, beforeEach } from "vitest";
import { saveWorkflow, listWorkflows, loadWorkflow, deleteWorkflow } from "./workflowStore";
import type { Workflow } from "./workflow";

beforeEach(() => localStorage.clear());

const sample: Workflow = { nodes: [], edges: [] };

describe("workflowStore", () => {
  it("round-trips a named workflow", () => {
    saveWorkflow("alpha", sample);
    expect(loadWorkflow("alpha")).toEqual(sample);
    expect(listWorkflows().map((w) => w.name)).toContain("alpha");
  });

  it("listWorkflows returns name + savedAt", () => {
    saveWorkflow("beta", sample);
    const list = listWorkflows();
    const beta = list.find((w) => w.name === "beta");
    expect(beta).toBeDefined();
    expect(typeof beta!.savedAt).toBe("number");
  });

  it("loadWorkflow returns null when absent", () => {
    expect(loadWorkflow("nope")).toBeNull();
  });

  it("deleteWorkflow removes it", () => {
    saveWorkflow("gamma", sample);
    deleteWorkflow("gamma");
    expect(loadWorkflow("gamma")).toBeNull();
  });

  it("ignores corrupt entries", () => {
    localStorage.setItem("prizma.workflow.bad", "{not json");
    expect(listWorkflows().length).toBe(0);
  });
});
