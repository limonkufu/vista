import "@testing-library/jest-dom";

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveBeenCalledWith(...args: any[]): R;
      toHaveBeenCalledTimes(count: number): R;
      toContainElement(element: Element | null): R;
      toHaveClass(...classNames: string[]): R;
      not: {
        toBeInTheDocument(): R;
        toHaveClass(...classNames: string[]): R;
      };
    }
  }
}

export {};
