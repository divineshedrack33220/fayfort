import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        title="No sourcing requests yet"
        description="Calculate your first landed cost."
      />,
    );
    expect(screen.getByText("No sourcing requests yet")).toBeInTheDocument();
    expect(screen.getByText("Calculate your first landed cost.")).toBeInTheDocument();
  });

  it("renders and triggers the action button", async () => {
    const onAction = vi.fn();
    render(
      <EmptyState title="None yet" actionLabel="Calculate my landed cost" onAction={onAction} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Calculate my landed cost" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("omits the action button when no action label is provided", () => {
    render(<EmptyState title="None yet" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
