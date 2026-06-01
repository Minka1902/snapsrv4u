const { MongoClient, ObjectId } = require('mongodb');

class MongoAdapter {
    constructor({ uri = 'mongodb://localhost:27017', name = 'snapsrv4u' } = {}) {
        this.uri = uri;
        this.dbName = name;
        this.client = null;
        this.db = null;
    }

    async connect() {
        this.client = new MongoClient(this.uri);
        await this.client.connect();
        this.db = this.client.db(this.dbName);
    }

    async getCollection(collection) {
        return this.db.collection(collection).find({}).toArray();
    }

    async findById(id, collection) {
        return this.db.collection(collection).findOne({ _id: new ObjectId(id) });
    }

    async insert(collection, item) {
        const result = await this.db.collection(collection).insertOne(item);
        return { ...item, _id: result.insertedId };
    }

    async deleteById(id, collection) {
        const result = await this.db.collection(collection).deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount > 0;
    }
}

module.exports = MongoAdapter;
