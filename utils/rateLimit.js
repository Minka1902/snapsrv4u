module.exports = function createRateLimiter({ max, windowMs }) {
    const counters = new Map();
    return function checkLimit(req, route) {
        const key = (req.ip || 'unknown') + ':' + route;
        const now = Date.now();
        const entry = counters.get(key);
        if (!entry || now > entry.resetAt) {
            counters.set(key, { count: 1, resetAt: now + windowMs });
            return false;
        }
        entry.count++;
        return entry.count > max;
    };
};
