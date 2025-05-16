# 🚀 Mock API Server
A powerful and flexible mock API server that automatically generates realistic data based on your specifications using Faker.js, it also optionally integrates with a file-based CSV database "snap4db" to simulate persistent data and accordingly reacts as an API.

## 📦 Installation
```bash
npm install snapsrv4u
```

## 🚀 Quick start without a database
### Supports GET requests only
```javascript
const { MockApiServer } = require('snapsrv4u');

const server = new MockApiServer(4517); // default value

server.addRoute('/api/users', {
  method: 'GET',
  count: 10, // number of objects created
  properties: { // description of all the objects (created with faker.js)
    id: { type: 'id', zeros: 5 },
    name: { type: 'name' },
    email: { type: 'email' }
  }
});

server.start(); // starting the server
```
### Supported types for Faker.js
| Category | Types                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Numbers  | `number`, `float`, `id`, `uuid`                                                                          |
| Strings  | `string`, `sentence`, `paragraph`                                                                        |
| Dates    | `date`, `past`, `future`, `timestamp`                                                                    |
| Personal | `firstname`, `lastname`, `fullname`, `username`, `email`, `avatar`, `phone`, `gender`, `jobTitle`, `bio` |
| Location | `latitude`, `longitude`, `city`, `country`, `address`, `zipcode`                                         |
| Internet | `url`, `ipv4`, `password`, `useragent`                                                                   |
| Company  | `company`, `department`, `catchPhrase`                                                                   |
| Commerce | `product`, `price`, `color`                                                                              |
| Boolean  | `boolean`                                                                                                |
| Custom   | `faker` with `method` and `options` (e.g., `faker: { method: 'music.genre' }`)                           |

## 📝 Creating a server with database
### GET POST and DELETE requests
```javascript
const server = new MockApiServer(port); // port defaults to 4517
```

### Adding POST routes
```javascript
// POST request
server.addRoute('/sign-up', {
    method: 'POST', // required
    collection: 'users', // required
    properties: {
        name: { type: 'name' }, // describes the the property
        email: { type: 'email', unique: true } // can be a unique property
    }
});
```

### Adding DELETE routes
Gets data from body, params or query
```javascript
// POST request
server.addRoute('/delete-from-known-collection/:id', {
    method: 'DELETE',
    collection: 'users'
});

server.addRoute('/delete-from-unknown-collection/:id', {
    method: 'DELETE'
});
```

### Adding GET routes
Gets data from body, params or query
```javascript
// POST request
server.addRoute('/get-from-known-collection/:id', {
    method: 'GET',
    collection: 'users'
});

server.addRoute('/get-from-unknown-collection/:id', {
    method: 'GET'
});
```

#### Config Options
- `method`: HTTP method ('GET', 'POST' or 'DELETE')
- `count`: Number of items to generate (1 for single object, >1 for array). will only work with quick start
- `properties`: Object describing the data structure

## 📚 Supported Data Types
| Type      | Description                    |  Options                   |
|-----------|--------------------------------|----------------------------|
| `number`  | Random number                  |  `min`, `max`              |
| `string`  | Random string                  |  `min`, `max` (length)     |
| `boolean` | Random true/false              |  -                         |
| `date`    | Random date                    |  `from`, `to`              |
| `name`    | Random full name               |  -                         |
| `email`   | Random email address           |  -                         |
| `uuid`    | Random UUID                    |  -                         |
| `id`      | Numeric ID with padding        |  `zeros` (padding length)  |

Or anything else from faker.js

## 🔧 Configuration Options
Each property can have these configurations:

- `type`: (Required) Data type to generate
- `min`: Minimum value/length
- `max`: Maximum value/length
- `zeros`: Number of digits for IDs
- `from`: Start date for date ranges
- `to`: End date for date ranges

## Future features
1) PUT requests
2) Adding the option to send data automatically (on timer)
3) Creating a log for incoming requests
4) Customizable response (function)
