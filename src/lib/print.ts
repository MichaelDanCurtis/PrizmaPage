/// The CSS class marking elements hidden in print output. Document/editor
/// chrome adds this; print.css hides them under @media print.
export const PRINT_HIDDEN_CLASS = "no-print";

/// Trigger the OS print dialog (the user picks "Save as PDF" for export).
/// Call AFTER any print-prep; no-op if window.print is unavailable.
export function printDocument(): void {
  if (typeof window !== "undefined" && typeof window.print === "function") {
    window.print();
  }
}
