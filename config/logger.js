const { createLogger, format, transports } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

const LOGS_DIR = path.join(__dirname, "../logs");
const RETENTION = `${process.env.LOG_RETENTION_DAYS || 30}d`;

const { combine, timestamp, printf, colorize, errors, json } = format;

const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] ${level}: ${message}${metaStr}`;
});

// ─── Transports ──────────────────────────────────────────────────────────────

const makeRotate = (filename, level) =>
  new DailyRotateFile({
    dirname: LOGS_DIR,
    filename: `${filename}-%DATE%.log`,
    datePattern: "YYYY-MM-DD",
    maxFiles: RETENTION,
    zippedArchive: true,
    level,
    format: combine(timestamp(), errors({ stack: true }), json()),
  });

// ─── Loggers ─────────────────────────────────────────────────────────────────

const appLogger = createLogger({
  level: "info",
  transports: [
    makeRotate("app", "info"),
    makeRotate("error", "error"),
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "HH:mm:ss" }),
        consoleFormat
      ),
    }),
  ],
});

const requestLogger = createLogger({
  level: "info",
  transports: [makeRotate("requests", "info")],
});

const statsLogger = createLogger({
  level: "info",
  transports: [makeRotate("stats", "info")],
});

module.exports = { appLogger, requestLogger, statsLogger };
