const { faker } = require('@faker-js/faker');
const express = require('express');
const cors = require("cors");

class MockApiServer {
    constructor(port = 3000) {
        this.app = express();
        this.app.options('*', cors());
        this.app.use(cors());
        this.port = port;

        // this.routes = new Map();
    }

    generateValue(type, config = {}) {
        const { min = 0, max = 1000, zeros = 5 } = config;

        // Basic types
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
            case 'jobTitle': return faker.person.jobTitle();
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
            case 'catchPhrase': return faker.company.catchPhrase();

            // Commerce
            case 'product': return faker.commerce.productName();
            case 'price': return faker.commerce.price();
            case 'color': return faker.color.human();

            // Boolean
            case 'boolean': return faker.datatype.boolean();

            // Allow direct faker access
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

    // Pre-configured person schema
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

        this.app[method.toLowerCase()](path, (req, res) => {
            try {
                let responseData;

                if (count === 1) {
                    responseData = this.generateObject(finalProperties);
                } else {
                    responseData = Array.from({ length: count }, () =>
                        this.generateObject(finalProperties)
                    );
                }

                res.json({ data: responseData });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`Mock API Server running at http://localhost:${this.port}`);
        });
    }
}
 