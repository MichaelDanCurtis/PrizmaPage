import { describe, it, expect } from "vitest";
import { TEMPLATES, getTemplate } from "./templates";

describe("templates", () => {
  it("includes a Blank template with minimal body", () => {
    const blank = getTemplate("blank");
    expect(blank).toBeDefined();
    expect(blank!.body.trim()).toMatch(/^#\s/);
  });

  it("every template has an id, title, and non-empty body starting with a heading", () => {
    for (const t of TEMPLATES) {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.body.trim().length).toBeGreaterThan(0);
      expect(t.body.trim()).toMatch(/^#\s/);
    }
  });

  it("meeting-notes template contains Agenda and action items use checklists", () => {
    const m = getTemplate("meeting-notes");
    expect(m!.body).toMatch(/agenda/i);
    expect(m!.body).toContain("- [ ] Owner");
  });

  it("returns undefined for unknown id", () => {
    expect(getTemplate("nope")).toBeUndefined();
  });
});
