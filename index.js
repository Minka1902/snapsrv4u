const http = require('http');
const { faker } = require('@faker-js/faker');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const MockDB = require('snap4db');
const { getUniquePropertyNames, getFaultyPropertyNames } = require('./utils/functions');

class MockApiServer {
    /**
     * @param {object|number} options - Config object or legacy port number
     * @param {number}  [options.port=4517]
     * @param {string}  [options.dbName]      - snap4db database name (legacy)
     * @param {object}  [options.db]          - Real database config
     * @param {string}  [options.db.type]     - 'mongodb' | 'postgres' | 'sqlite'
     * @param {string}  [options.db.uri]      - MongoDB URI
     * @param {string}  [options.db.connectionString] - Postgres connection string
     * @param {string}  [options.db.filename] - SQLite filename
     * @param {string}  [options.db.name]     - MongoDB database name
     * @param {boolean} [options.websocket=true]  - Enable ws raw WebSocket server
     * @param {boolean} [options.socketio=true]   - Enable Socket.io server
     */
    constructor(options = {}) {
        // Support legacy positional signature: new MockApiServer(port, dbName)
        if (typeof options === 'number') {
            options = { port: options, dbName: arguments[1] || null };
        }

        const {
            port = 4517,
            dbName = null,
            db = null,
            websocket = true,
            socketio = true,
        } = options;

        this.port = port;
        this._wsEnabled = websocket;
        this._sioEnabled = socketio;
        this._socketHandlers = {};

        this.app = express();
        this.app.options(/.*/, cors());
        this.app.use(cors());
        this.app.use(bodyParser.json());

        // Database setup
        if (db) {
            this.db = this._createAdapter(db);
        } else if (dbName) {
            this.db = new MockDB(dbName);
        } else {
            this.db = null;
        }
    }

    _createAdapter(dbConfig) {
        const { type } = dbConfig;
        switch (type) {
            case 'mongodb': {
                const MongoAdapter = require('./adapters/MongoAdapter');
                return new MongoAdapter(dbConfig);
            }
            case 'postgres': {
                const PostgresAdapter = require('./adapters/PostgresAdapter');
                return new PostgresAdapter(dbConfig);
            }
            case 'sqlite': {
                const SqliteAdapter = require('./adapters/SqliteAdapter');
                return new SqliteAdapter(dbConfig);
            }
            default:
                throw new Error(`Unknown db.type "${type}". Use 'mongodb', 'postgres', or 'sqlite'.`);
        }
    }

    _broadcast(event, payload) {
        const message = JSON.stringify({ event, ...payload });
        if (this.io) {
            this.io.emit(event, payload);
        }
        if (this.wss) {
            this.wss.clients.forEach(client => {
                if (client.readyState === 1 /* OPEN */) {
                    client.send(message);
                }
            });
        }
    }

    /**
     * Register a custom Socket.io / WebSocket event handler.
     * @param {string} event - Event name
     * @param {function} handler - Called with (data, socket) for Socket.io,
     *                             or (data, wsClient) for raw WebSocket
     */
    addSocketEvent(event, handler) {
        this._socketHandlers[event] = handler;
    }

    generateValue(type, config = {}) {
        const { min = 0, max = 1000, zeros = 9 } = config;

        switch (type.toLowerCase()) {
            // Numbers and IDs
            case 'number': return faker.number.int({ min, max });
            case 'float': return faker.number.float({ min, max, precision: 0.01 });
            case 'id': return faker.string.numeric(zeros);
            case 'uuid': return faker.string.uuid();

            // Strings
            case 'string': return faker.string.alpha({ min: min || 5, max: max || 10 });
            case 'sentence': return faker.lorem.sentence();
            case 'paragraph': return faker.lorem.paragraph();

            // Dates and times
            case 'date': return faker.date.between({
                from: config.from || '2020-01-01',
                to: config.to || '2024-12-31'
            });
            case 'past': return faker.date.past();
            case 'future': return faker.date.future();
            case 'timestamp': return faker.date.recent().getTime();

            // Person data
            case 'firstname': return faker.person.firstName();
            case 'lastname': return faker.person.lastName();
            case 'fullname': return faker.person.fullName();
            case 'username': return faker.internet.username();
            case 'email': return faker.internet.email();
            case 'avatar': return faker.image.avatar();
            case 'phone': return faker.phone.number();
            case 'gender': return faker.person.gender();
            case 'jobtitle': return faker.person.jobTitle();
            case 'bio': return faker.person.bio();

            // Internet
            case 'url': return faker.internet.url();
            case 'ipv4': return faker.internet.ip();
            case 'password': return faker.internet.password();
            case 'useragent': return faker.internet.userAgent();

            // Location
            case 'latitude': return faker.location.latitude();
            case 'longitude': return faker.location.longitude();
            case 'city': return faker.location.city();
            case 'country': return faker.location.country();
            case 'address': return faker.location.streetAddress();
            case 'zipcode': return faker.location.zipCode();

            // Company
            case 'company': return faker.company.name();
            case 'department': return faker.commerce.department();
            case 'catchphrase': return faker.company.catchPhrase();

            // Commerce
            case 'product': return faker.commerce.productName();
            case 'price': return faker.commerce.price();
            case 'color': return faker.color.human();

            // Boolean
            case 'boolean': return faker.datatype.boolean();

            // Direct faker access
            case 'faker':
                if (config.method) {
                    const [namespace, method] = config.method.split('.');
                    return faker[namespace][method](config.options);
                }
                return null;

            default:
                return null;
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
            userId: { type: 'uuid' },
            username: { type: 'username' },
            firstName: { type: 'firstname' },
            lastName: { type: 'lastname' },
            email: { type: 'email' },
            avatar: { type: 'avatar' },
            phone: { type: 'phone' },
            dateOfBirth: { type: 'past' },
            address: { type: 'address' },
            bio: { type: 'bio' },
            jobTitle: { type: 'jobTitle' },
            registeredAt: { type: 'timestamp' }
        };
    }

    addRoute(path, config) {
        const {
            method = 'GET',
            count = 1,
            properties
        } = config;

        const finalProperties = properties === 'person' ?
            MockApiServer.personSchema : properties;

        this.app[method.toLowerCase()](path, async (req, res) => {
            try {
                if (method.toLowerCase() === 'get') {
                    let responseData;
                    if (properties) {
                        if (count === 1) {
                            responseData = this.generateObject(finalProperties);
                        } else {
                            responseData = Array.from({ length: count }, () =>
                                this.generateObject(finalProperties)
                            );
                        }
                    } else if (req.params.id) {
                        responseData = await this.db.findById(req.params.id, config.collection);
                    } else if (req.body && req.body.id) {
                        responseData = await this.db.findById(req.body.id, config?.collection);
                    } else if (req.query.id) {
                        responseData = await this.db.findById(req.query.id, config?.collection);
                    } else {
                        responseData = 'Cant find object';
                    }
                    res.json({ data: responseData });

                } else if (method.toLowerCase() === 'post') {
                    const unique = properties ? getUniquePropertyNames(properties) : [];
                    let response;
                    if (unique.length !== 0) {
                        const col = await this.db.getCollection(config.collection);
                        if (col.length !== 0) {
                            const isUnique = getFaultyPropertyNames(req.body, col, unique);
                            if (isUnique.length === 0) {
                                response = req.body ? await this.db.insert(config.collection, req.body) : 'No data received.';
                            } else {
                                return res.json({ error: { message: `Property <${isUnique}> needs to be unique` } });
                            }
                        } else {
                            response = req.body ? await this.db.insert(config.collection, req.body) : 'No data received.';
                        }
                    } else {
                        response = req.body ? await this.db.insert(config.collection, req.body) : 'No data received.';
                    }
                    this._broadcast('created', { route: path, record: response });
                    res.json(response);

                } else if (method.toLowerCase() === 'delete') {
                    let resp;
                    if (req.params && req.params.id) {
                        resp = await this.db.deleteById(req.params.id, config?.collection);
                    } else if (req.body && req.body.id) {
                        resp = await this.db.deleteById(req.body.id, config?.collection);
                    } else if (req.query.id) {
                        resp = await this.db.deleteById(req.query.id, config?.collection);
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
        // Connect the real DB adapter if one was configured
        if (this.db && typeof this.db.connect === 'function') {
            await this.db.connect();
        }

        const server = http.createServer(this.app);

        // Socket.io
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

        // Raw WebSocket (ws)
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
            const lines = [`Mock API Server running at http://localhost:${this.port}`];
            if (this.io) lines.push(`  Socket.io  → ws://localhost:${this.port}`);
            if (this.wss) lines.push(`  WebSocket  → ws://localhost:${this.port}`);
            console.log(lines.join('\n'));
        });

        this.server = server;
        return server;
    }
}

module.exports = MockApiServer;
