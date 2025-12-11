import chalk from "chalk";

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

		const fullMessage = `[${new Date().toLocaleTimeString()}][${level.toUpperCase()}][${module}][${context}] ${message}`;
		switch (level) {
			case "trace":
				console.log(chalk.gray(fullMessage));
				return;
			case "info":
				console.log(fullMessage);
				return;
			case "warn":
				console.log(chalk.yellow(fullMessage));
				return;
			case "error":
				console.log(chalk.red(fullMessage));
				return;
			case "fatal":
				console.log(chalk.magenta(fullMessage));
				return;
			default:
				console.log(chalk.blue(fullMessage));
		}
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
