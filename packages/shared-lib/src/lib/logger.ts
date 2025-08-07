const pino = require('pino');

const isDevelopment = process.env.NODE_ENV !== 'production';

// Create a base logger configuration
const loggerConfig = isDevelopment
  ? {
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    }
  : {
      level: 'info',
      formatters: {
        level: (label: string) => {
          return { level: label.toUpperCase() };
        },
      },
      timestamp: () => `,"timestamp":"${new Date(Date.now()).toISOString()}"`,
    };

// Create the main logger instance
export const logger = pino(loggerConfig);

// Create child loggers for different parts of the application
export const serviceLogger = logger.child({ component: 'service' });
export const dbLogger = logger.child({ component: 'database' });
export const authLogger = logger.child({ component: 'auth' });

// Logger utility functions
export const loggers = {
  app: logger,
  service: serviceLogger,
  database: dbLogger,
  auth: authLogger,

  // Create a child logger with custom context
  child: (context: Record<string, any>) => logger.child(context),

  // Log performance metrics
  performance: (
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ) => {
    logger.info(
      {
        operation,
        duration,
        ...metadata,
      },
      `Performance: ${operation} completed in ${duration}ms`
    );
  },

  // Log database operations
  dbOperation: (
    operation: string,
    table: string,
    metadata?: Record<string, any>
  ) => {
    dbLogger.debug(
      {
        operation,
        table,
        ...metadata,
      },
      `Database: ${operation} on ${table}`
    );
  },

  // Log API calls
  apiCall: (
    method: string,
    endpoint: string,
    userId?: string,
    metadata?: Record<string, any>
  ) => {
    logger.info(
      {
        method,
        endpoint,
        userId,
        ...metadata,
      },
      `API: ${method} ${endpoint}`
    );
  },

  // Log errors with context
  error: (error: Error, context?: Record<string, any>) => {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        ...context,
      },
      `Error: ${error.message}`
    );
  },

  // Log service errors specifically
  serviceError: (error: Error, context?: Record<string, any>) => {
    serviceLogger.error(
      {
        error: error.message,
        stack: error.stack,
        ...context,
      },
      `Service Error: ${error.message}`
    );
  },
};

export default logger;
