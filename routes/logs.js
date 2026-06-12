const { randomUUID } = require("crypto");
const router = require("express").Router();
const { requestLogger, appLogger } = require("../config/logger");
const { recordRequest } = require("../middleware/statsStore");
const { sendApiErrorAlert } = require("../services/mailService");

/**
 * POST /api/log/request
 * Called by the frontend axios interceptor for every request it sends.
 *
 * Body: {
 *   method, url, endpoint, status, statusText,
 *   duration, requestData, responseData, error,
 *   sessionId, userId
 * }
 */
router.post("/request", (req, res) => {
  try {
    const {
      method = "UNKNOWN",
      url = "",
      endpoint = url,
      status: statusCode = 0,
      statusText = "",
      duration = null,
      requestData = null,
      responseData = null,
      error = null,
      success = null,
      page = null,
      sessionId = null,
      userId = null,
    } = req.body;

    const { ip, geo, device, referer, language } = req.clientInfo;

    // Dériver success depuis statusCode si non fourni explicitement
    const isSuccess = success !== null ? success : (statusCode >= 200 && statusCode < 400);

    const logEntry = {
      id: randomUUID(),
      type: "api_request",
      method,
      url,
      endpoint,
      statusCode,
      statusText,
      success: isSuccess,
      duration,
      page,
      ip,
      geo,
      device,
      referer,
      language,
      sessionId,
      userId,
      requestData: sanitize(requestData),
      responseData: sanitize(responseData),
      error: error ? { message: error.message, code: error.code } : null,
      timestamp: new Date().toISOString(),
    };

    requestLogger.info("api_request", logEntry);
    recordRequest(logEntry);

    // Emit to dashboard via socket (attached in server.js)
    if (req.app.locals.io) {
      req.app.locals.io.emit("new_log", logEntry);
    }

    res.status(200).json({ ok: true, id: logEntry.id });
  } catch (err) {
    appLogger.error("Failed to process log entry", { err: err.message });
    res.status(500).json({ ok: false });
  }
});

/**
 * POST /api/log/pageview
 * Lightweight page navigation tracking.
 */
router.post("/pageview", (req, res) => {
  try {
    const { path = "/", title = "", sessionId = null, userId = null } = req.body;
    const { ip, geo, device } = req.clientInfo;

    const entry = {
      id: randomUUID(),
      type: "pageview",
      path,
      title,
      ip,
      geo,
      device,
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    };

    requestLogger.info("pageview", entry);
    recordRequest({ ...entry, method: "NAV", endpoint: path, statusCode: 200, duration: null });

    if (req.app.locals.io) {
      req.app.locals.io.emit("new_log", entry);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    appLogger.error("Failed to record pageview", { err: err.message });
    res.status(500).json({ ok: false });
  }
});

/**
 * POST /api/log/error
 * Client-side JS errors (window.onerror, unhandledrejection).
 */
router.post("/error", (req, res) => {
  try {
    const { message, stack, source, lineno, colno, sessionId, userId } = req.body;
    const { ip, device } = req.clientInfo;

    const entry = {
      id: randomUUID(),
      type: "client_error",
      message,
      stack,
      source,
      lineno,
      colno,
      ip,
      device,
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    };

    requestLogger.error("client_error", entry);
    recordRequest({ ...entry, method: "ERR", endpoint: source || "unknown", statusCode: 500, duration: null });

    if (req.app.locals.io) {
      req.app.locals.io.emit("new_log", entry);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    appLogger.error("Failed to record client error", { err: err.message });
    res.status(500).json({ ok: false });
  }
});

/**
 * POST /api/log/alert-email
 * Alerte email sur erreur API (appelé par le frontend).
 */
router.post("/alert-email", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      requestData: sanitize(req.body.requestData),
      responseData: sanitize(req.body.responseData),
      error: req.body.error ? sanitize(req.body.error) : null,
    };

    const result = await sendApiErrorAlert(payload);

    const entry = {
      id: randomUUID(),
      type: "api_error_alert",
      to: payload.to,
      method: payload.method,
      endpoint: payload.endpoint,
      statusCode: payload.status,
      page: payload.page,
      emailSent: result.ok,
      timestamp: new Date().toISOString(),
    };

    requestLogger.warn("api_error_alert", entry);
    recordRequest({
      ...entry,
      method: payload.method || "ERR",
      endpoint: payload.endpoint || "unknown",
      statusCode: payload.status || 500,
      duration: payload.duration ?? null,
    });

    if (req.app.locals.io) {
      req.app.locals.io.emit("new_log", entry);
    }

    if (!result.ok) {
      return res.status(503).json({ ok: false, reason: result.reason });
    }

    res.status(200).json({ ok: true, id: entry.id });
  } catch (err) {
    appLogger.error("Failed to send alert email", { err: err.message });
    res.status(500).json({ ok: false });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set(["password", "token", "access_token", "refresh_token", "secret", "card_number", "cvv"]);

function sanitize(data) {
  if (!data || typeof data !== "object") return data;
  const out = Array.isArray(data) ? [] : {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : sanitize(v);
  }
  return out;
}

module.exports = router;
