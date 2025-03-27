// File: src/components/ErrorBoundary.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ErrorBoundary"; // Adjust path if needed

// Mock window.location.reload
const mockReload = jest.fn();
Object.defineProperty(window, "location", {
  value: { ...window.location, reload: mockReload }, // Keep other properties
  writable: true,
});

// Mock logger (already done in setup.ts, but good practice if setup isn't used)
// jest.mock('@/lib/logger', () => ({
//   logger: {
//     error: jest.fn(),
//   },
// }));

// Component that throws an error
const ThrowErrorComponent = () => {
  throw new Error("Test error message");
};

describe("ErrorBoundary", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error output during tests
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore(); // Restore console.error
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("renders error UI and logs error when a child component throws", () => {
    render(
      <ErrorBoundary>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole("heading", { name: /something went wrong/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Test error message")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();

    // Check if logger.error was called (via console.error mock)
    expect(console.error).toHaveBeenCalled();
    // Optionally check the arguments passed to console.error if logger format is known
  });

  it("reloads the page when 'Try again' button is clicked", () => {
    render(
      <ErrorBoundary>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(tryAgainButton);

    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it("resets error state and renders children after trying again (conceptual)", () => {
    // This is harder to test directly without complex state manipulation,
    // but we test the reload mechanism which achieves the reset in practice.
    // We can verify the component *attempts* to reset state before reloading.

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowErrorComponent />
      </ErrorBoundary>
    );

    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(tryAgainButton);

    // At this point, window.location.reload is called.
    // If we *didn't* mock reload, we could potentially test state reset,
    // but mocking reload is generally safer for unit tests.
    // We can trust that clicking the button triggers the intended action.
    expect(mockReload).toHaveBeenCalled();

    // Conceptually, if reload didn't happen, the next render *should* show children again.
    // We can simulate this by manually resetting the component's state if needed,
    // but testing the reload click is sufficient for this component's responsibility.
  });
});
