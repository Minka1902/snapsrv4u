# 🚀 Mock API Server
A powerful and flexible mock API server that automatically generates realistic data based on your specifications using Faker.js

## 📦 Installation
```bash
npm install snapsrv4u
```

## 🚀 Quick Start
```javascript
import { MockApiServer } from 'snapsrv4u';

const server = new MockApiServer(3000);

server.addRoute('/api/users', {
  method: 'GET',
  count: 10,
  properties: {
    id: { type: 'id', zeros: 5 },
    name: { type: 'name' },
    email: { type: 'email' }
  }
});

server.start();
```

## 🎯 Features
- 🔥 Zero configuration required
- 🎲 Automatic data generation
- 📊 Configurable data types and ranges
- 🛠 Customizable response structure
- ⚡️ Fast and lightweight

## 📝 API Reference
### Creating a Server
```javascript
const server = new MockApiServer(port); // port defaults to 3000
```

### Adding Routes
```javascript
server.addRoute(path, config);
```

#### Config Options
- `method`: HTTP method ('GET', 'POST', etc.)
- `count`: Number of items to generate (1 for single object, >1 for array)
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

## 💡 Examples
```javascript
server.addRoute('/api/person', {
  method: 'GET',
  count: 1,
  properties: 'person'
});
```

## 🔧 Configuration Options
Each property can have these configurations:

- `type`: (Required) Data type to generate
- `min`: Minimum value/length
- `max`: Maximum value/length
- `zeros`: Number of digits for IDs
- `from`: Start date for date ranges
- `to`: End date for date ranges
