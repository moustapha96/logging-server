const { UAParser } = require("ua-parser-js");
const geoip = require("geoip-lite");

/**
 * Extracts the real client IP through proxies/load-balancers.
 */
function getRealIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Parses User-Agent into a structured object.
 */
function parseDevice(uaString) {
  const parser = new UAParser(uaString || "");
  const result = parser.getResult();
  return {
    browser: `${result.browser.name || "Unknown"} ${result.browser.version || ""}`.trim(),
    os: `${result.os.name || "Unknown"} ${result.os.version || ""}`.trim(),
    device: result.device.type || "desktop",
    deviceVendor: result.device.vendor || null,
    deviceModel: result.device.model || null,
    rawUA: uaString,
  };
}

/**
 * Looks up geolocation for an IP address.
 */
function getGeoInfo(ip) {
  if (!ip || ip === "unknown" || ip === "::1" || ip === "127.0.0.1") {
    return { country: "Local", city: null, region: null, ll: null };
  }
  const geo = geoip.lookup(ip);
  if (!geo) return { country: "Unknown", city: null, region: null, ll: null };
  return {
    country: geo.country,
    city: geo.city,
    region: geo.region,
    ll: geo.ll,
    timezone: geo.timezone,
  };
}

/**
 * Express middleware: attaches clientInfo to every request.
 */
function parseClientMiddleware(req, _res, next) {
  const ip = getRealIp(req);
  req.clientInfo = {
    ip,
    geo: getGeoInfo(ip),
    device: parseDevice(req.headers["user-agent"]),
    referer: req.headers["referer"] || null,
    language: req.headers["accept-language"] || null,
  };
  next();
}

module.exports = { parseClientMiddleware, getRealIp, parseDevice, getGeoInfo };
