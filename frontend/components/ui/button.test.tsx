import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Calculate landed cost</Button>);
    expect(screen.getByRole("button", { name: "Calculate landed cost" })).toBeInTheDocument();
  });

  it("applies the primary intent class by default", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("bg-brand-600");
  });

  it("applies the requested variant classes", () => {
    render(<Button intent="danger">Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("bg-danger-600");
  });

  it("shows a spinner and disables the button while loading", () => {
    render(<Button loading>Submitting…</Button>);
    const button = screen.getByRole("button", { name: "Submitting…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  it("does not fire clicks while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Save" });
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
