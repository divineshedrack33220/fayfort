import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "@/components/ui/alert";

describe("Alert", () => {
  it("renders title and body content", () => {
    render(
      <Alert tone="info" title="ESTIMATE">
        Final costs may vary.
      </Alert>,
    );
    expect(screen.getByText("ESTIMATE")).toBeInTheDocument();
    expect(screen.getByText("Final costs may vary.")).toBeInTheDocument();
  });

  it("does not announce an info alert as a live region", () => {
    const { container } = render(<Alert tone="info">Note</Alert>);
    expect(container.firstChild).not.toHaveAttribute("role", "alert");
  });

  it("announces danger alerts with role=alert", () => {
    const { container } = render(<Alert tone="danger">Failed to upload</Alert>);
    expect(container.firstChild).toHaveAttribute("role", "alert");
  });

  it("renders the correct tone styling", () => {
    const { container } = render(<Alert tone="success">Done</Alert>);
    expect(container.firstChild).toHaveClass("border-success-200");
  });
});
