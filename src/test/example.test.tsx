import { render, screen } from "@testing-library/react";

describe("Initial Jest Setup", () => {
  it("sample test passes", () => {
    expect(true).toBe(true);
  });

  it("can render a simple component", () => {
    render(<div data-testid="example">Test Component</div>);
    const element = screen.getByTestId("example");
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent("Test Component");
  });
});
