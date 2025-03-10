const isDevelopment = process.env.NODE_ENV === 'development';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMessage {
  message: string;
  data?: any;
  timestamp?: string;
  level?: LogLevel;
  component?: string;
}

const formatLogMessage = ({ message, data, timestamp = new Date().toISOString(), level = 'info', component }: LogMessage) => {
  return {
    timestamp,
    level,
    component,
    message,
    ...(data && { data }),
  };
};

export const logger = {
  debug: (message: string, data?: any, component?: string) => {
    if (isDevelopment) {
      console.debug(formatLogMessage({ message, data, level: 'debug', component }));
    }
  },

  info: (message: string, data?: any, component?: string) => {
    if (isDevelopment) {
      console.info(formatLogMessage({ message, data, level: 'info', component }));
    }
  },

  warn: (message: string, data?: any, component?: string) => {
    console.warn(formatLogMessage({ message, data, level: 'warn', component }));
  },

  error: (message: string, data?: any, component?: string) => {
    console.error(formatLogMessage({ message, data, level: 'error', component }));
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
    logger.debug(`Performance: ${name}`, { duration: `${duration.toFixed(2)}ms` });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Performance Error: ${name}`, { duration: `${duration.toFixed(2)}ms`, error });
    throw error;
  }
}; 