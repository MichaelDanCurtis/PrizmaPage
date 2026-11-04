import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustFooter } from "./TrustFooter";

describe("TrustFooter", () => {
  it("shows signed status with domain when manifest is signed", () => {
    render(<TrustFooter filename="q4.mdxz" signatureDomain="acme.com" />);
    expect(screen.getByText(/q4\.mdxz/)).toBeInTheDocument();
    expect(screen.getByText(/signed:\s+acme\.com/i)).toBeInTheDocument();
  });

  it("shows unsigned status when signature is null", () => {
    render(<TrustFooter filename="notes.mdxz" signatureDomain={null} />);
    expect(screen.getByText(/notes\.mdxz/)).toBeInTheDocument();
    expect(screen.getByText(/unsigned/i)).toBeInTheDocument();
  });
});
