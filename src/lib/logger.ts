// Determine development mode safely across client and server
const isDevelopment =
  typeof window === "undefined"
    ? process.env.NODE_ENV === "development"
    : process.env.NEXT_PUBLIC_NODE_ENV === "development";

// Determine test mode safely
const isTest =
  typeof window === "undefined"
    ? process.env.NODE_ENV === "test"
    : process.env.NEXT_PUBLIC_NODE_ENV === "test";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogMessage {
  message: string;
  data?: unknown;
  timestamp?: string;
  level?: LogLevel;
  component?: string;
}

// Format log messages with consistent structure
const formatLogMessage = ({
  message,
  data,
  timestamp = new Date().toISOString(),
  level = "info",
  component,
}: LogMessage) => {
  return {
    timestamp,
    level,
    component: component || "App",
    message,
    ...(data && { data }),
  };
};

// Helper to format error objects properly
const formatErrorData = (data: unknown): unknown => {
  if (data instanceof Error) {
    return {
      message: data.message,
      name: data.name,
      stack: data.stack,
    };
  }

  if (data && typeof data === "object" && data !== null) {
    const objData = data as Record<string, unknown>;
    if (objData.error instanceof Error) {
      return {
        ...objData,
        error: {
          message: objData.error.message,
          name: objData.error.name,
          stack: objData.error.stack,
        },
      };
    }
  }

  return data;
};

export const logger = {
  debug: (message: string, data?: unknown, component?: string) => {
    if (isDevelopment && !isTest) {
      console.debug(
        formatLogMessage({
          message,
          data: formatErrorData(data),
          level: "debug",
          component,
        })
      );
    }
  },

  info: (message: string, data?: unknown, component?: string) => {
    if (isDevelopment && !isTest) {
      console.info(
        formatLogMessage({
          message,
          data: formatErrorData(data),
          level: "info",
          component,
        })
      );
    }
  },

  warn: (message: string, data?: unknown, component?: string) => {
    if (!isTest) {
      console.warn(
        formatLogMessage({
          message,
          data: formatErrorData(data),
          level: "warn",
          component,
        })
      );
    }
  },

  error: (message: string, data?: unknown, component?: string) => {
    if (!isTest) {
      console.error(
        formatLogMessage({
          message,
          data: formatErrorData(data),
          level: "error",
          component,
        })
      );
    }
  },
};

// Performance monitoring utility
export const measurePerformance = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    logger.debug(`Performance: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
    });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Performance Error: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
      error,
    });
    throw error;
  }
};
