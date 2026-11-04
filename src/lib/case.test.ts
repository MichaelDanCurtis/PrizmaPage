import { describe, it, expect } from "vitest";
import { toUpperCase, toLowerCase, toTitleCase, toSentenceCase } from "./case";

describe("case transforms", () => {
  it("toUpperCase", () => { expect(toUpperCase("hello World")).toBe("HELLO WORLD"); });
  it("toLowerCase", () => { expect(toLowerCase("Hello WORLD")).toBe("hello world"); });
  it("toTitleCase", () => { expect(toTitleCase("hello world foo")).toBe("Hello World Foo"); });
  it("toSentenceCase", () => { expect(toSentenceCase("hello. world. foo.")).toBe("Hello. World. Foo."); });
  it("toSentenceCase handles empty", () => { expect(toSentenceCase("")).toBe(""); });
});
