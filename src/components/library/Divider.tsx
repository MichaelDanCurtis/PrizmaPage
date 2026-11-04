import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

export const Divider: FC<ComponentProps> = () => (
  <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "20px 0" }} />
);
