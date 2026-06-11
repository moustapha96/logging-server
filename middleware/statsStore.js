/**
 * In-memory statistics store.
 * Resets on server restart – for persistence, swap with Redis or SQLite.
 */

const store = {
  startTime: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  totalSuccess: 0,
  requestsPerMinute: [],   // rolling window [{ts, count}]
  endpointCounts: {},      // { "POST /api/auth/login": 42 }
  statusCodes: {},         // { "200": 150, "401": 10 }
  ipCounts: {},            // { "1.2.3.4": 5 }
  deviceTypes: {},         // { "mobile": 30, "desktop": 70 }
  browsers: {},            // { "Chrome 120": 40 }
  countries: {},           // { "SN": 80, "FR": 10 }
  responseTimes: [],       // last 1000 durations in ms
  activeConnections: new Set(),  // socket ids
  recentLogs: [],          // circular buffer – last 200 log entries
};

const MAX_RECENT = 200;
const MAX_RT_SAMPLES = 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function increment(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

function avgResponseTime() {
  if (!store.responseTimes.length) return 0;
  const sum = store.responseTimes.reduce((a, b) => a + b, 0);
  return Math.round(sum / store.responseTimes.length);
}

function requestsPerMinuteNow() {
  const now = Date.now();
  const oneMin = 60_000;
  store.requestsPerMinute = store.requestsPerMinute.filter(
    (e) => now - e.ts < oneMin
  );
  return store.requestsPerMinute.length;
}

// ─── Public API ───────────────────────────────────────────────────────────────

function recordRequest(logEntry) {
  store.totalRequests++;
  const { statusCode, success, duration, endpoint, method, ip, device, geo } = logEntry;

  const isError = success !== undefined ? !success : statusCode >= 400;
  if (isError) store.totalErrors++;
  else store.totalSuccess++;

  increment(store.endpointCounts, `${method} ${endpoint}`);
  increment(store.statusCodes, String(statusCode));
  if (ip) increment(store.ipCounts, ip);
  if (device?.device) increment(store.deviceTypes, device.device);
  if (device?.browser) increment(store.browsers, device.browser);
  if (geo?.country) increment(store.countries, geo.country);

  if (duration != null) {
    store.responseTimes.push(duration);
    if (store.responseTimes.length > MAX_RT_SAMPLES) store.responseTimes.shift();
  }

  store.requestsPerMinute.push({ ts: Date.now() });

  store.recentLogs.push({ ...logEntry, ts: Date.now() });
  if (store.recentLogs.length > MAX_RECENT) store.recentLogs.shift();
}

function getSnapshot() {
  const uptime = Math.floor((Date.now() - store.startTime) / 1000);
  return {
    uptime,
    totalRequests: store.totalRequests,
    totalErrors: store.totalErrors,
    totalSuccess: store.totalSuccess,
    errorRate:
      store.totalRequests > 0
        ? ((store.totalErrors / store.totalRequests) * 100).toFixed(2)
        : "0.00",
    requestsPerMinute: requestsPerMinuteNow(),
    avgResponseTimeMs: avgResponseTime(),
    topEndpoints: Object.entries(store.endpointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count })),
    statusCodes: store.statusCodes,
    topIps: Object.entries(store.ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([ip, count]) => ({ ip, count })),
    deviceTypes: store.deviceTypes,
    browsers: Object.entries(store.browsers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([browser, count]) => ({ browser, count })),
    countries: store.countries,
    activeConnections: store.activeConnections.size,
    recentLogs: store.recentLogs.slice(-50).reverse(),
  };
}

function addConnection(socketId) {
  store.activeConnections.add(socketId);
}

function removeConnection(socketId) {
  store.activeConnections.delete(socketId);
}

module.exports = {
  recordRequest,
  getSnapshot,
  addConnection,
  removeConnection,
  store,
};
