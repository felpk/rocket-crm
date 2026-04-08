type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function timestamp() {
  return new Date().toISOString();
}

function format(level: LogLevel, module: string, message: string, data?: unknown) {
  const prefix = `[${timestamp()}] [${level}] [${module}]`;
  if (data !== undefined) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

export function createLogger(module: string) {
  return {
    info: (message: string, data?: unknown) =>
      console.log(format("INFO", module, message, data)),
    warn: (message: string, data?: unknown) =>
      console.warn(format("WARN", module, message, data)),
    error: (message: string, data?: unknown) =>
      console.error(format("ERROR", module, message, data)),
    debug: (message: string, data?: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(format("DEBUG", module, message, data));
      }
    },
  };
}
