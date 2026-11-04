import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustFooter } from "./TrustFooter";

describe("TrustFooter", () => {
  it("shows valid signature status with keyid", () => {
    render(<TrustFooter filename="q4.mdxz" originDomain="acme.com" verifyResult={{ state: "valid", keyid: "deadbeefcafebabe" }} />);
    expect(screen.getByText(/q4\.mdxz/)).toBeInTheDocument();
    expect(screen.getByText(/✓ signed/i)).toBeInTheDocument();
  });

  it("shows unsigned status when verifyResult is unsigned", () => {
    render(<TrustFooter filename="notes.mdxz" originDomain={null} verifyResult={{ state: "unsigned" }} />);
    expect(screen.getByText(/notes\.mdxz/)).toBeInTheDocument();
    expect(screen.getByText(/unsigned/i)).toBeInTheDocument();
  });

  it("shows invalid status when signature is invalid", () => {
    render(<TrustFooter filename="tampered.mdxz" originDomain="evil.com" verifyResult={{ state: "invalid", reason: "no match" }} />);
    expect(screen.getByText(/✗ invalid signature/i)).toBeInTheDocument();
  });

  it("shows origin domain when present", () => {
    render(<TrustFooter filename="doc.mdxz" originDomain="example.com" verifyResult={{ state: "unsigned" }} />);
    expect(screen.getByText(/from example\.com/i)).toBeInTheDocument();
  });
});
