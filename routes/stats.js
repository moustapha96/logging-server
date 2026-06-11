const router = require("express").Router();
const { getSnapshot } = require("../middleware/statsStore");

/** GET /api/stats — full statistics snapshot */
router.get("/", (_req, res) => {
  res.json(getSnapshot());
});

/** GET /api/stats/health — quick health check */
router.get("/health", (_req, res) => {
  const snap = getSnapshot();
  res.json({
    status: "ok",
    uptime: snap.uptime,
    totalRequests: snap.totalRequests,
    errorRate: snap.errorRate,
    requestsPerMinute: snap.requestsPerMinute,
  });
});

module.exports = router;
