/**
 * Sends structured log entries to the logging server.
 * All calls are fire-and-forget – never throw to the caller.
 */

const LOGGER_URL = import.meta.env.VITE_LOGGER_URL || "http://localhost:4001";

let sessionId = sessionStorage.getItem("_log_session");
if (!sessionId) {
  sessionId = crypto.randomUUID();
  sessionStorage.setItem("_log_session", sessionId);
}

function getUserId() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw)?.id : null;
  } catch {
    return null;
  }
}

async function send(path, payload, retries = 2) {
  const body = JSON.stringify({ ...payload, sessionId, userId: getUserId() });
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${LOGGER_URL}/api/log/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
      if (res.ok) return;
      // Serveur répond mais avec une erreur — inutile de retenter
      console.warn(`[logger] Serveur a repondu ${res.status} pour /${path}`);
      return;
    } catch (err) {
      // Réseau indisponible — on retente après un court délai
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      } else {
        console.warn(`[logger] Impossible de joindre ${LOGGER_URL} — logs perdus (/${path})`);
      }
    }
  }
}

export function logRequest(data) {
  return send("request", data);
}

export function logPageView(path, title) {
  return send("pageview", { path, title });
}

export function logClientError(error, source, extra = {}) {
  return send("error", {
    message: error?.message || String(error),
    stack: error?.stack || null,
    source: source || window.location.pathname,
    lineno: extra.lineno ?? null,
    colno: extra.colno ?? null,
  });
}
