// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock next-nprogress-bar
jest.mock('next-nprogress-bar', () => ({
  AppProgressBar: () => null,
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  measurePerformance: jest.fn((name, fn) => fn()),
}));

// Mock keyboard shortcuts
jest.mock('@/hooks/useKeyboardShortcut', () => ({
  useKeyboardShortcut: jest.fn(),
}));

// Mock intersection observer
class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock match media
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
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