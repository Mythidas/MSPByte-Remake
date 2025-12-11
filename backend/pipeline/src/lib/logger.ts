import Debug from "@workspace/shared/lib/Debug.js";

type LogLevel = "trace" | "info" | "warn" | "error" | "fatal";
type LogMessage = {
  module?: string;
  context: string;
  message: string;
  level: LogLevel;
};

export class Logger {
  static level: LogLevel = "trace";

  static log({ module = "Pipeline", context, message, level }: LogMessage) {
    if (!this.isValidLevel(level)) return;

    Debug.log({
      module,
      context,
      message: `[${level}] ${message}`,
    });
  }

  private static isValidLevel(level: LogLevel) {
    switch (Logger.level) {
      case "trace":
        return true;
      case "info":
        return level !== "trace";
      case "warn":
        return level !== "info" && level !== "trace";
      case "error":
        return level !== "warn" && level !== "info" && level !== "trace";
      default:
        return true;
    }
  }
}
