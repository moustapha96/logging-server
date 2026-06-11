require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server: SocketIO } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const { appLogger } = require("./config/logger");
const { parseClientMiddleware } = require("./middleware/parseClient");
const { addConnection, removeConnection, getSnapshot } = require("./middleware/statsStore");

const logsRouter = require("./routes/logs");
const statsRouter = require("./routes/stats");

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();
const httpServer = http.createServer(app);

// ─── Socket.io (real-time dashboard) ─────────────────────────────────────────

const allowedOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const io = new SocketIO(httpServer, {
  cors: { origin: [...allowedOrigins, /localhost/], methods: ["GET", "POST"] },
});

app.locals.io = io;

io.on("connection", (socket) => {
  appLogger.info(`Dashboard connected: ${socket.id}`);
  addConnection(socket.id);

  // Send current snapshot immediately on connect
  socket.emit("stats_snapshot", getSnapshot());

  socket.on("disconnect", () => {
    appLogger.info(`Dashboard disconnected: ${socket.id}`);
    removeConnection(socket.id);
  });
});

// Push stats snapshot to all dashboard clients every 5 seconds
setInterval(() => {
  io.emit("stats_snapshot", getSnapshot());
}, 5000);

// ─── Security & Middleware ────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: false, // dashboard needs inline scripts
  })
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o)) || /localhost/.test(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS blocked: ${origin}`));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Session-Id"],
  })
);

app.use(compression());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true }));

// Morgan – HTTP access log to console (dev friendly)
app.use(
  morgan(
    ':remote-addr - :method :url :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
    {
      stream: { write: (msg) => appLogger.http(msg.trim()) },
      skip: (req) => req.url.startsWith("/api/stats/health"),
    }
  )
);

// Rate limit logging endpoints (protect against flooding)
const logLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || "200", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many log requests" },
});

// Attach client info (IP, geo, device) to every request
app.use(parseClientMiddleware);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/log", logLimiter, logsRouter);
app.use("/api/stats", statsRouter);

// Serve the real-time dashboard
app.use("/dashboard", express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => {
  res.redirect("/dashboard");
});

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Global error handler
app.use((err, _req, res, _next) => {
  appLogger.error("Unhandled error", { message: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  appLogger.info(`Logger server running on http://localhost:${PORT}`);
  appLogger.info(`Dashboard available at http://localhost:${PORT}/dashboard`);
  appLogger.info(`Accepting logs from: ${allowedOrigins.join(", ") || "all localhost"}`);
});

process.on("uncaughtException", (err) => {
  appLogger.error("Uncaught exception", { message: err.message, stack: err.stack });
});
process.on("unhandledRejection", (reason) => {
  appLogger.error("Unhandled rejection", { reason: String(reason) });
});
