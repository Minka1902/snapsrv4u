module.exports = function createLogger(logLevel) {
    return function loggerMiddleware(req, res, next) {
        const start = Date.now();
        res.on('finish', () => {
            const ms = Date.now() - start;
            console.log(`[${req.method}] ${req.path} → ${res.statusCode} (${ms}ms)`);
            if (logLevel === 'verbose' && req.body && Object.keys(req.body).length) {
                console.log('  body:', JSON.stringify(req.body));
            }
        });
        next();
    };
};
