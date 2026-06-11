const http = require('http');
const { faker } = require('@faker-js/faker');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const MockDB = require('snap4db');
const { getUniquePropertyNames, getFaultyPropertyNames } = require('./utils/functions');
const createRateLimiter = require('./utils/rateLimit');
const createLogger = require('./utils/logger');

class MockApiServer {
    /**
     * @param {object|number} options
     * @param {number}  [options.port=4517]
     * @param {string}  [options.dbName]           - snap4db name (legacy)
     * @param {object}  [options.db]               - Real DB config { type, uri, connectionString, filename, name }
     * @param {boolean} [options.websocket=true]   - Enable raw WebSocket server
     * @param {boolean} [options.socketio=true]    - Enable Socket.io server
     * @param {string}  [options.logLevel]         - 'none' | 'basic' | 'verbose' (default: 'none')
     * @param {object}  [options.auth]             - Global API key auth { key: 'secret' }
     * @param {object}  [options.rateLimit]        - Global rate limit { max, windowMs }
     */
    constructor(options = {}) {
        if (typeof options === 'number') {
            options = { port: options, dbName: arguments[1] || null };
        }

        const {
            port = 4517,
            dbName = null,
            db = null,
            websocket = true,
            socketio = true,
            logLevel = 'none',
            auth = null,
            rateLimit = null,
        } = options;

        this.port = port;
        this._wsEnabled = websocket;
        this._sioEnabled = socketio;
        this._socketHandlers = {};
        this._routes = [];
        this._globalAuth = auth;
        this._globalRateLimiter = rateLimit ? createRateLimiter(rateLimit) : null;

        this.app = express();
        this.app.options(/.*/, cors());
        this.app.use(cors());
        this.app.use(bodyParser.json());

        if (logLevel && logLevel !== 'none') {
            this.app.use(createLogger(logLevel));
        }

        if (db) {
            this.db = this._createAdapter(db);
        } else if (dbName) {
            this.db = new MockDB(dbName);
        } else {
            this.db = null;
        }
    }

    // ─── Static factory ────────────────────────────────────────────────────────

    /**
     * Create a server from a plain config object (used by CLI and config-file mode).
     * @param {object} config
     * @returns {MockApiServer}
     */
    static fromConfig(config) {
        const { routes = [], ...serverOptions } = config;
        const server = new MockApiServer(serverOptions);
        for (const route of routes) {
            const { path, ...routeConfig } = route;
            server.addRoute(path, routeConfig);
        }
        return server;
    }

    // ─── Internal helpers ───────────────────────────────────────────────────────

    _createAdapter(dbConfig) {
        switch (dbConfig.type) {
            case 'mongodb': return new (require('./adapters/MongoAdapter'))(dbConfig);
            case 'postgres': return new (require('./adapters/PostgresAdapter'))(dbConfig);
            case 'sqlite': return new (require('./adapters/SqliteAdapter'))(dbConfig);
            default: throw new Error(`Unknown db.type "${dbConfig.type}". Use 'mongodb', 'postgres', or 'sqlite'.`);
        }
    }

    _broadcast(event, payload) {
        const message = JSON.stringify({ event, ...payload });
        if (this.io) this.io.emit(event, payload);
        if (this.wss) {
            this.wss.clients.forEach(client => {
                if (client.readyState === 1) client.send(message);
            });
        }
    }

    _resolveDelay(delay) {
        if (typeof delay === 'number') return delay;
        const { min = 0, max = 1000 } = delay;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    _checkAuth(req, authConfig) {
        if (!authConfig) return true;
        const provided = req.headers['x-api-key']
            || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
        return provided === authConfig.key;
    }

    _buildDashboardHtml() {
        const routes = JSON.stringify(this._routes);
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>snapsrv4u — Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; }
  header { padding: 20px 32px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 1.25rem; font-weight: 600; color: #f8fafc; }
  header span { font-size: 0.75rem; background: #1e293b; color: #94a3b8; padding: 2px 8px; border-radius: 999px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em; }
  .GET    { background: #052e16; color: #4ade80; }
  .POST   { background: #1e3a5f; color: #60a5fa; }
  .DELETE { background: #450a0a; color: #f87171; }
  .main { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 24px 32px; }
  @media(max-width:768px) { .main { grid-template-columns: 1fr; } }
  .card { background: #1e293b; border-radius: 10px; overflow: hidden; }
  .card-header { padding: 14px 18px; border-bottom: 1px solid #334155; font-size: 0.8rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; display: flex; justify-content: space-between; align-items: center; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px 18px; text-align: left; font-size: 0.72rem; color: #64748b; font-weight: 600; border-bottom: 1px solid #334155; }
  td { padding: 10px 18px; font-size: 0.82rem; border-bottom: 1px solid #1e293b; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #263347; }
  #log { padding: 0; list-style: none; max-height: 420px; overflow-y: auto; }
  #log li { padding: 10px 18px; font-size: 0.8rem; border-bottom: 1px solid #0f172a; display: flex; gap: 10px; align-items: flex-start; }
  #log li:last-child { border-bottom: none; }
  #log .time { color: #475569; font-size: 0.72rem; white-space: nowrap; padding-top: 1px; }
  #log .route { color: #94a3b8; }
  #log .record { color: #cbd5e1; font-family: monospace; font-size: 0.75rem; word-break: break-all; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; display: inline-block; margin-right: 6px; animation: pulse 2s infinite; }
  .dot.off { background: #475569; animation: none; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .empty { padding: 24px 18px; color: #475569; font-size: 0.82rem; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>snapsrv4u</h1>
  <span id="status"><span class="dot off" id="dot"></span>connecting…</span>
</header>
<div class="main">
  <div class="card">
    <div class="card-header">Registered Routes <span id="route-count"></span></div>
    <table id="route-table">
      <thead><tr><th>Method</th><th>Path</th><th>Collection</th><th>Count</th></tr></thead>
      <tbody id="route-body"></tbody>
    </table>
  </div>
  <div class="card">
    <div class="card-header">Live Event Log <span id="event-count">0 events</span></div>
    <ul id="log"><li class="empty">Waiting for events…</li></ul>
  </div>
</div>
<script>
const routes = ${routes};
const tbody = document.getElementById('route-body');
const logEl = document.getElementById('log');
let eventCount = 0;

document.getElementById('route-count').textContent = routes.length + ' routes';

if (routes.length === 0) {
  tbody.innerHTML = '<tr><td colspan="4" class="empty">No routes registered yet.</td></tr>';
} else {
  routes.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><span class="badge ' + r.method + '">' + r.method + '</span></td>' +
      '<td>' + r.path + '</td>' +
      '<td>' + (r.collection || '—') + '</td>' +
      '<td>' + (r.count != null ? r.count : '—') + '</td>';
    tbody.appendChild(tr);
  });
}

const wsUrl = 'ws://' + location.host;
let ws;
function connect() {
  ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    document.getElementById('dot').classList.remove('off');
    document.getElementById('status').innerHTML = '<span class="dot"></span>connected';
  };
  ws.onclose = () => {
    document.getElementById('dot').classList.add('off');
    document.getElementById('status').innerHTML = '<span class="dot off"></span>disconnected — retrying…';
    setTimeout(connect, 2000);
  };
  ws.onmessage = ({ data }) => {
    try {
      const msg = JSON.parse(data);
      if (!['created','deleted'].includes(msg.event)) return;
      if (logEl.querySelector('.empty')) logEl.innerHTML = '';
      eventCount++;
      document.getElementById('event-count').textContent = eventCount + ' event' + (eventCount !== 1 ? 's' : '');
      const li = document.createElement('li');
      const time = new Date().toLocaleTimeString();
      const badge = msg.event === 'created'
        ? '<span class="badge POST">created</span>'
        : '<span class="badge DELETE">deleted</span>';
      li.innerHTML =
        '<span class="time">' + time + '</span>' +
        '<span>' + badge + ' <span class="route">' + msg.route + '</span>' +
        (msg.record ? '<br><span class="record">' + JSON.stringify(msg.record) + '</span>' : '') +
        (msg.id ? ' <span class="record">id: ' + msg.id + '</span>' : '') +
        '</span>';
      logEl.prepend(li);
    } catch {}
  };
}
connect();
</script>
</body>
</html>`;
    }

    // ─── Public API ─────────────────────────────────────────────────────────────

    /**
     * Register a custom Socket.io / WebSocket event handler.
     * @param {string} event
     * @param {function} handler - (data, socket) => void
     */
    addSocketEvent(event, handler) {
        this._socketHandlers[event] = handler;
    }

    /**
     * Register a route on the server.
     * @param {string} path
     * @param {object} config
     * @param {string}  [config.method='GET']
     * @param {number}  [config.count=1]
     * @param {object|string} [config.properties]
     * @param {string}  [config.collection]
     * @param {number|object} [config.delay]        - ms or { min, max }
     * @param {number}  [config.errorRate]          - 0–1 probability of 500 error
     * @param {number}  [config.errorStatus=500]
     * @param {object}  [config.auth]               - { key } — overrides global auth
     * @param {object}  [config.rateLimit]          - { max, windowMs } — overrides global
     * @param {boolean} [config.paginate]           - auto-paginate GET via ?page&limit
     */
    addRoute(path, config) {
        const {
            method = 'GET',
            count = 1,
            properties,
        } = config;

        this._routes.push({ method: method.toUpperCase(), path, collection: config.collection || null, count });

        const finalProperties = properties === 'person' ? MockApiServer.personSchema : properties;
        const routeRateLimiter = config.rateLimit ? createRateLimiter(config.rateLimit) : null;

        this.app[method.toLowerCase()](path, async (req, res) => {
            try {
                // ── 1. Delay ──────────────────────────────────────────────────
                if (config.delay != null) {
                    await new Promise(r => setTimeout(r, this._resolveDelay(config.delay)));
                }

                // ── 2. Error rate ─────────────────────────────────────────────
                if (config.errorRate && Math.random() < config.errorRate) {
                    return res.status(config.errorStatus || 500).json({ error: 'Simulated server error' });
                }

                // ── 3. Auth ───────────────────────────────────────────────────
                const authCfg = config.auth !== undefined ? config.auth : this._globalAuth;
                if (!this._checkAuth(req, authCfg)) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }

                // ── 4. Rate limit ─────────────────────────────────────────────
                const limiter = routeRateLimiter || this._globalRateLimiter;
                if (limiter && limiter(req, path)) {
                    return res.status(429).json({ error: 'Too many requests' });
                }

                // ── 5. Method handling ────────────────────────────────────────
                if (method.toLowerCase() === 'get') {
                    let responseData;
                    if (properties) {
                        responseData = count === 1
                            ? this.generateObject(finalProperties)
                            : Array.from({ length: count }, () => this.generateObject(finalProperties));
                    } else if (req.params.id) {
                        responseData = await this.db.findById(req.params.id, config.collection);
                    } else if (req.body && req.body.id) {
                        responseData = await this.db.findById(req.body.id, config.collection);
                    } else if (req.query.id) {
                        responseData = await this.db.findById(req.query.id, config.collection);
                    } else {
                        responseData = await this.db.getCollection(config.collection);
                    }

                    // ── Pagination ────────────────────────────────────────────
                    if (config.paginate && Array.isArray(responseData)) {
                        const page  = Math.max(1, parseInt(req.query.page)  || 1);
                        const limit = Math.max(1, parseInt(req.query.limit) || 10);
                        const total = responseData.length;
                        return res.json({
                            data:       responseData.slice((page - 1) * limit, page * limit),
                            total,
                            page,
                            limit,
                            totalPages: Math.ceil(total / limit),
                        });
                    }

                    res.json({ data: responseData });

                } else if (method.toLowerCase() === 'post') {
                    const unique = properties ? getUniquePropertyNames(properties) : [];
                    let response;
                    if (unique.length !== 0) {
                        const col = await this.db.getCollection(config.collection);
                        if (col.length !== 0) {
                            const isUnique = getFaultyPropertyNames(req.body, col, unique);
                            if (isUnique.length !== 0) {
                                return res.json({ error: { message: `Property <${isUnique}> needs to be unique` } });
                            }
                        }
                    }
                    response = req.body ? await this.db.insert(config.collection, req.body) : 'No data received.';
                    this._broadcast('created', { route: path, record: response });
                    res.json(response);

                } else if (method.toLowerCase() === 'delete') {
                    let resp;
                    if (req.params && req.params.id) {
                        resp = await this.db.deleteById(req.params.id, config.collection);
                    } else if (req.body && req.body.id) {
                        resp = await this.db.deleteById(req.body.id, config.collection);
                    } else if (req.query.id) {
                        resp = await this.db.deleteById(req.query.id, config.collection);
                    } else {
                        resp = "Didn't find any item with this ID";
                    }
                    this._broadcast('deleted', { route: path, id: req.params?.id || req.body?.id || req.query?.id });
                    res.json({ message: resp });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    async start() {
        if (this.db && typeof this.db.connect === 'function') {
            await this.db.connect();
        }

        // Dashboard at GET /
        const dashboardHtml = this._buildDashboardHtml();
        this.app.get('/', (req, res) => {
            res.setHeader('Content-Type', 'text/html');
            res.send(dashboardHtml);
        });

        const server = http.createServer(this.app);

        if (this._sioEnabled) {
            try {
                const { Server } = require('socket.io');
                this.io = new Server(server, { cors: { origin: '*' } });
                this.io.on('connection', socket => {
                    for (const [event, handler] of Object.entries(this._socketHandlers)) {
                        socket.on(event, data => handler(data, socket));
                    }
                });
            } catch {
                console.warn('[snapsrv4u] socket.io not installed — Socket.io disabled. Run: npm install socket.io');
            }
        }

        if (this._wsEnabled) {
            try {
                const { WebSocketServer } = require('ws');
                this.wss = new WebSocketServer({ server });
                this.wss.on('connection', ws => {
                    ws.on('message', raw => {
                        try {
                            const { event, data } = JSON.parse(raw);
                            const handler = this._socketHandlers[event];
                            if (handler) handler(data, ws);
                        } catch { /* ignore malformed messages */ }
                    });
                });
            } catch {
                console.warn('[snapsrv4u] ws not installed — WebSocket disabled. Run: npm install ws');
            }
        }

        server.listen(this.port, () => {
            const lines = [
                `Mock API Server running at http://localhost:${this.port}`,
                `  Dashboard  → http://localhost:${this.port}/`,
            ];
            if (this.io)  lines.push(`  Socket.io  → ws://localhost:${this.port}`);
            if (this.wss) lines.push(`  WebSocket  → ws://localhost:${this.port}`);
            console.log(lines.join('\n'));
        });

        this.server = server;
        return server;
    }

    // ─── Data generation ────────────────────────────────────────────────────────

    generateValue(type, config = {}) {
        const { min = 0, max = 1000, zeros = 9 } = config;
        switch (type.toLowerCase()) {
            case 'number':    return faker.number.int({ min, max });
            case 'float':     return faker.number.float({ min, max, precision: 0.01 });
            case 'id':        return faker.string.numeric(zeros);
            case 'uuid':      return faker.string.uuid();
            case 'string':    return faker.string.alpha({ min: min || 5, max: max || 10 });
            case 'sentence':  return faker.lorem.sentence();
            case 'paragraph': return faker.lorem.paragraph();
            case 'date':      return faker.date.between({ from: config.from || '2020-01-01', to: config.to || '2024-12-31' });
            case 'past':      return faker.date.past();
            case 'future':    return faker.date.future();
            case 'timestamp': return faker.date.recent().getTime();
            case 'firstname': return faker.person.firstName();
            case 'lastname':  return faker.person.lastName();
            case 'fullname':  return faker.person.fullName();
            case 'username':  return faker.internet.username();
            case 'email':     return faker.internet.email();
            case 'avatar':    return faker.image.avatar();
            case 'phone':     return faker.phone.number();
            case 'gender':    return faker.person.gender();
            case 'jobtitle':  return faker.person.jobTitle();
            case 'bio':       return faker.person.bio();
            case 'url':       return faker.internet.url();
            case 'ipv4':      return faker.internet.ip();
            case 'password':  return faker.internet.password();
            case 'useragent': return faker.internet.userAgent();
            case 'latitude':  return faker.location.latitude();
            case 'longitude': return faker.location.longitude();
            case 'city':      return faker.location.city();
            case 'country':   return faker.location.country();
            case 'address':   return faker.location.streetAddress();
            case 'zipcode':   return faker.location.zipCode();
            case 'company':   return faker.company.name();
            case 'department':  return faker.commerce.department();
            case 'catchphrase': return faker.company.catchPhrase();
            case 'product':   return faker.commerce.productName();
            case 'price':     return faker.commerce.price();
            case 'color':     return faker.color.human();
            case 'boolean':   return faker.datatype.boolean();
            case 'faker':
                if (config.method) {
                    const [namespace, method] = config.method.split('.');
                    return faker[namespace][method](config.options);
                }
                return null;
            default: return null;
        }
    }

    generateObject(properties) {
        const result = {};
        for (const [key, config] of Object.entries(properties)) {
            result[key] = this.generateValue(config.type, config);
        }
        return result;
    }

    static get personSchema() {
        return {
            userId:      { type: 'uuid' },
            username:    { type: 'username' },
            firstName:   { type: 'firstname' },
            lastName:    { type: 'lastname' },
            email:       { type: 'email' },
            avatar:      { type: 'avatar' },
            phone:       { type: 'phone' },
            dateOfBirth: { type: 'past' },
            address:     { type: 'address' },
            bio:         { type: 'bio' },
            jobTitle:    { type: 'jobTitle' },
            registeredAt: { type: 'timestamp' },
        };
    }
}

module.exports = MockApiServer;
