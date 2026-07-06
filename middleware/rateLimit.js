/**
 * 此刻 Moment - 简易IP限流中间件
 */
const rateLimitMap = {};
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 60;

// Periodic cleanup: only clear expired entries
setInterval(() => {
  const now = Date.now();
  for (const ip of Object.keys(rateLimitMap)) {
    if (rateLimitMap[ip].resetAt < now) delete rateLimitMap[ip];
  }
}, 10 * 60 * 1000);

function rateLimit(req, res, next) {
  // Use req.ip (trusts Express's proxy settings) instead of raw header
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!rateLimitMap[ip]) {
    rateLimitMap[ip] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW };
    return next();
  }

  const entry = rateLimitMap[ip];
  if (now > entry.resetAt) {
    rateLimitMap[ip] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW };
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }

  next();
}

module.exports = rateLimit;
