# Mock API Server

A lightweight mock API server that generates realistic fake data using Faker.js, persists it to a real or file-based database, and pushes live updates to connected clients over WebSocket and Socket.io.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Constructor Options](#constructor-options)
- [Database Adapters](#database-adapters)
  - [snap4db (default)](#snap4db-default)
  - [SQLite](#sqlite)
  - [PostgreSQL](#postgresql)
  - [MongoDB](#mongodb)
- [Adding Routes](#adding-routes)
  - [GET](#get)
  - [POST](#post)
  - [DELETE](#delete)
- [Real-Time: WebSocket & Socket.io](#real-time-websocket--socketio)
- [Pre-built Schemas](#pre-built-schemas)
- [Supported Data Types](#supported-data-types)
- [Property Config Options](#property-config-options)

---

## Installation

```bash
npm install snapsrv4u
```

Install only the database driver(s) you need:

```bash
npm install better-sqlite3   # SQLite
npm install pg               # PostgreSQL
npm install mongodb          # MongoDB
```

Install real-time transports if you need them:

```bash
npm install ws               # raw WebSocket
npm install socket.io        # Socket.io
```

---

## Quick Start

Generate fake data with no database — GET requests only.

```js
const MockApiServer = require('snapsrv4u');

const server = new MockApiServer({ port: 4517 });

server.addRoute('/api/users', {
  method: 'GET',
  count: 10,
  properties: {
    id:    { type: 'uuid' },
    name:  { type: 'fullname' },
    email: { type: 'email' }
  }
});

server.start();
// GET http://localhost:4517/api/users  →  { data: [ { id, name, email }, ... ] }
```

---

## Constructor Options

```js
const server = new MockApiServer({
  port:      4517,    // port to listen on (default: 4517)
  dbName:    'mydb',  // snap4db database name (legacy option)
  db:        { ... }, // real database config (see Database Adapters)
  websocket: true,    // attach a raw ws WebSocket server (default: true)
  socketio:  true,    // attach a Socket.io server (default: true)
});
```

The legacy positional signature still works for backwards compatibility:

```js
const server = new MockApiServer(4517);
// or
const server = new MockApiServer(4517, 'mydb');
```

---

## Database Adapters

### snap4db (default)

A file-based CSV store included with the package. No extra install needed.

```js
const server = new MockApiServer({
  port:   4517,
  dbName: 'myDatabase'
});
```

---

### SQLite

Stores data in a local `.db` file (or in memory with `':memory:'`).

```js
const server = new MockApiServer({
  port: 4517,
  db: {
    type:     'sqlite',
    filename: './data.db'   // use ':memory:' for an in-memory database
  }
});
```

---

### PostgreSQL

Connects to a running Postgres instance. Tables are created automatically — no migrations needed.

```js
// Using a connection string
const server = new MockApiServer({
  port: 4517,
  db: {
    type:             'postgres',
    connectionString: 'postgresql://user:password@localhost:5432/mydb'
  }
});

// Or individual fields
const server = new MockApiServer({
  port: 4517,
  db: {
    type:     'postgres',
    host:     'localhost',
    port:     5432,
    database: 'mydb',
    user:     'postgres',
    password: 'secret'
  }
});
```

---

### MongoDB

Connects to a running MongoDB instance. Collections are created on first use.

```js
const server = new MockApiServer({
  port: 4517,
  db: {
    type: 'mongodb',
    uri:  'mongodb://localhost:27017',
    name: 'mydb'
  }
});
```

---

## Adding Routes

### GET

**Generate fake data on every request** (no database needed):

```js
server.addRoute('/api/products', {
  method: 'GET',
  count:  5,
  properties: {
    id:    { type: 'uuid' },
    name:  { type: 'product' },
    price: { type: 'price' },
    inStock: { type: 'boolean' }
  }
});
// GET /api/products  →  { data: [ {...}, {...}, ... ] }
```

**Fetch a single record from the database by ID:**

```js
// ID from URL param
server.addRoute('/api/users/:id', {
  method:     'GET',
  collection: 'users'
});
// GET /api/users/abc123

// ID from query string
server.addRoute('/api/users', {
  method:     'GET',
  collection: 'users'
});
// GET /api/users?id=abc123
```

**Use the built-in person schema shorthand:**

```js
server.addRoute('/api/people', {
  method:      'GET',
  count:       3,
  properties:  'person'
});
```

---

### POST

Inserts the request body into the database collection. Optionally enforces unique constraints.

```js
server.addRoute('/api/users', {
  method:     'POST',
  collection: 'users',
  properties: {
    username: { type: 'username', unique: true },
    email:    { type: 'email',    unique: true },
    password: { type: 'password' }
  }
});
```

```json
POST /api/users
{ "username": "alice", "email": "alice@example.com", "password": "s3cr3t" }

→ { "id": "...", "username": "alice", "email": "alice@example.com", "password": "s3cr3t" }
```

If a unique field is duplicated, the server responds with:

```json
{ "error": { "message": "Property <email> needs to be unique" } }
```

---

### DELETE

Removes a record by ID. Accepts the ID from URL params, query string, or request body.

```js
// From URL param
server.addRoute('/api/users/:id', {
  method:     'DELETE',
  collection: 'users'
});
// DELETE /api/users/abc123

// From query string
server.addRoute('/api/users', {
  method:     'DELETE',
  collection: 'users'
});
// DELETE /api/users?id=abc123
```

---

## Real-Time: WebSocket & Socket.io

When `ws` and/or `socket.io` are installed, the server automatically broadcasts events to all connected clients whenever data changes.

```js
const server = new MockApiServer({
  port: 4517,
  db:   { type: 'sqlite', filename: './data.db' }
});

server.addRoute('/api/messages', { method: 'POST',   collection: 'messages' });
server.addRoute('/api/messages/:id', { method: 'DELETE', collection: 'messages' });

server.start();
```

**Events emitted automatically:**

| Event | Triggered by | Payload |
|-------|-------------|---------|
| `created` | Successful POST | `{ route, record }` |
| `deleted` | Successful DELETE | `{ route, id }` |

**Listening with Socket.io (browser / Node client):**

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4517');

socket.on('created', ({ route, record }) => {
  console.log('New record on', route, record);
});

socket.on('deleted', ({ route, id }) => {
  console.log('Deleted', id, 'from', route);
});
```

**Listening with a raw WebSocket:**

```js
const ws = new WebSocket('ws://localhost:4517');

ws.onmessage = ({ data }) => {
  const { event, route, record, id } = JSON.parse(data);
  console.log(event, route, record ?? id);
};
```

**Registering custom events** (server-side):

```js
server.addSocketEvent('chat:message', (data, socket) => {
  console.log('Received chat message:', data);
  // socket is the Socket.io socket or raw ws client
});
```

**Disabling real-time transports:**

```js
const server = new MockApiServer({
  port:      4517,
  websocket: false,  // disable raw WebSocket
  socketio:  false,  // disable Socket.io
});
```

---

## Pre-built Schemas

`MockApiServer.personSchema` is a ready-made 12-field schema for user/person data:

| Field | Type |
|-------|------|
| `userId` | uuid |
| `username` | username |
| `firstName` | firstname |
| `lastName` | lastname |
| `email` | email |
| `avatar` | avatar |
| `phone` | phone |
| `dateOfBirth` | past date |
| `address` | street address |
| `bio` | bio |
| `jobTitle` | jobTitle |
| `registeredAt` | timestamp |

Use it directly in any route:

```js
server.addRoute('/api/users', {
  method:     'GET',
  count:      5,
  properties: 'person'
});
```

Or access the schema object manually:

```js
const schema = MockApiServer.personSchema;
```

---

## Supported Data Types

Pass any of these as the `type` field in a property config.

| Category | Types |
|----------|-------|
| Numbers  | `number`, `float`, `id`, `uuid` |
| Strings  | `string`, `sentence`, `paragraph` |
| Dates    | `date`, `past`, `future`, `timestamp` |
| Personal | `firstname`, `lastname`, `fullname`, `username`, `email`, `avatar`, `phone`, `gender`, `jobTitle`, `bio` |
| Location | `latitude`, `longitude`, `city`, `country`, `address`, `zipcode` |
| Internet | `url`, `ipv4`, `password`, `useragent` |
| Company  | `company`, `department`, `catchPhrase` |
| Commerce | `product`, `price`, `color` |
| Boolean  | `boolean` |
| Custom   | `faker` — direct Faker.js method access (see below) |

**Custom faker access:**

```js
properties: {
  genre:   { type: 'faker', method: 'music.genre' },
  vehicle: { type: 'faker', method: 'vehicle.model' }
}
```

---

## Property Config Options

| Option | Applies to | Description |
|--------|-----------|-------------|
| `type` | all | (Required) Data type to generate |
| `min` | `number`, `float`, `string` | Minimum value or length |
| `max` | `number`, `float`, `string` | Maximum value or length |
| `zeros` | `id` | Number of digits (e.g. `zeros: 5` → `"00042"`) |
| `from` | `date` | Start of date range (e.g. `'2020-01-01'`) |
| `to` | `date` | End of date range (e.g. `'2024-12-31'`) |
| `unique` | any (POST) | Reject duplicates for this field (`true`/`false`) |
| `method` | `faker` | Faker.js path, e.g. `'music.genre'` |
| `options` | `faker` | Options object forwarded to the Faker.js method |
