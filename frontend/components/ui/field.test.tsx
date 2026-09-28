import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

describe("Field", () => {
  it("associates the label with the control when no id is given", () => {
    render(
      <Field label="Product name">
        <Input placeholder="Wireless earbuds" />
      </Field>,
    );
    const input = screen.getByPlaceholderText("Wireless earbuds");
    expect(input).toHaveAccessibleName("Product name");
  });

  it("renders hints and marks required fields", () => {
    render(
      <Field label="Quantity" hint="units" required>
        <Input />
      </Field>,
    );
    expect(screen.getByText("units")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("surfaces validation errors and links them to the control", () => {
    render(
      <Field label="Quantity" error="Quantity must be greater than zero.">
        <Input />
      </Field>,
    );
    const error = screen.getByText("Quantity must be greater than zero.");
    expect(error).toHaveAttribute("role", "alert");
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Quantity must be greater than zero.");
  });

  it("describes the control with the hint when there is no error", () => {
    render(
      <Field label="Quantity" hint="units">
        <Input />
      </Field>,
    );
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("units");
  });

  it("lists both hint and error in the control description", () => {
    render(
      <Field label="Quantity" hint="units" error="Quantity must be greater than zero.">
        <Input />
      </Field>,
    );
    const description = screen.getByRole("textbox").getAttribute("aria-describedby") ?? "";
    const texts = description
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");
    expect(texts).toContain("units");
    expect(texts).toContain("Quantity must be greater than zero.");
  });

  it("shows no error element when valid", () => {
    render(
      <Field label="Name">
        <Input />
      </Field>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("allows keyboard editing through the wired control", async () => {
    render(
      <Field label="Product name">
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox");
    const user = userEvent.setup();
    await user.type(input, "Solar panel");
    expect(input).toHaveValue("Solar panel");
  });
});
