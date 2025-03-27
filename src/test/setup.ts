import "@testing-library/jest-dom";
import { jest } from "@jest/globals";

// Define navigation globally for next-nprogress-bar
// @ts-expect-error - Adding custom property to window
window.navigation = {
  usePathname: () => "/dashboard",
};

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Next-nprogress-bar is mocked in __mocks__ directory

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  measurePerformance: jest.fn((name: string, fn: () => Promise<unknown>) =>
    fn()
  ),
}));

// Mock keyboard shortcuts
jest.mock("@/hooks/useKeyboardShortcut", () => ({
  useKeyboardShortcut: jest.fn(),
}));

// Mock Next.js navigation hooks
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock intersection observer
class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock match media
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock Next.js dynamic
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (fn: () => any) => {
    const Component = fn();
    Component.displayName = "DynamicComponent";
    return Component;
  },
}));
