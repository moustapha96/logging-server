const nodemailer = require("nodemailer");
const { appLogger } = require("../config/logger");

const ALERT_TO = process.env.ALERT_EMAIL_TO || "alhusseinkhoumadev@gmail.com";
const ALERT_FROM = process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER || "noreply@orbitcity.sn";

let transporter = null;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isConfigured()) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * @param {object} payload
 * @param {string} [payload.to]
 * @param {string} payload.method
 * @param {string} payload.endpoint
 * @param {number} payload.status
 * @param {string} [payload.statusText]
 * @param {string} [payload.page]
 * @param {string} [payload.timestamp]
 * @param {object} [payload.error]
 * @param {object} [payload.requestData]
 * @param {object} [payload.responseData]
 */
async function sendApiErrorAlert(payload) {
  const transport = getTransporter();
  if (!transport) {
    appLogger.warn("SMTP non configuré — alerte email ignorée");
    return { ok: false, reason: "smtp_not_configured" };
  }

  const to = payload.to || ALERT_TO;
  const subject = `[Orbit City] Erreur API ${payload.status} — ${payload.method} ${payload.endpoint}`;

  const text = [
    "Erreur API détectée sur Orbit City",
    "",
    `Date       : ${payload.timestamp || new Date().toISOString()}`,
    `Page       : ${payload.page || "—"}`,
    `Méthode    : ${payload.method || "—"}`,
    `Endpoint   : ${payload.endpoint || "—"}`,
    `URL        : ${payload.url || "—"}`,
    `Statut     : ${payload.status} ${payload.statusText || ""}`.trim(),
    `Durée      : ${payload.duration != null ? `${payload.duration} ms` : "—"}`,
    `Utilisateur: ${payload.userId ?? "anonyme"}`,
    "",
    "--- Erreur ---",
    JSON.stringify(payload.error, null, 2),
    "",
    "--- Requête ---",
    JSON.stringify(payload.requestData, null, 2),
    "",
    "--- Réponse ---",
    JSON.stringify(payload.responseData, null, 2),
    "",
    "--- Contexte ---",
    `User-Agent: ${payload.userAgent || "—"}`,
    `Environnement: ${payload.env || process.env.NODE_ENV || "—"}`,
  ].join("\n");

  await transport.sendMail({
    from: ALERT_FROM,
    to,
    subject,
    text,
  });

  appLogger.info("alert_email_sent", { to, endpoint: payload.endpoint, status: payload.status });
  return { ok: true };
}

module.exports = { sendApiErrorAlert, isConfigured };
