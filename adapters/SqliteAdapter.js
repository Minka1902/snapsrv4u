const Database = require('better-sqlite3');
const crypto = require('crypto');

class SqliteAdapter {
    constructor({ filename = './snapsrv4u.db' } = {}) {
        this.filename = filename;
        this.db = null;
    }

    async connect() {
        this.db = new Database(this.filename);
    }

    _ensureTable(collection) {
        this.db.prepare(`
            CREATE TABLE IF NOT EXISTS "${collection}" (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL
            )
        `).run();
    }

    async getCollection(collection) {
        this._ensureTable(collection);
        return this.db.prepare(`SELECT id, data FROM "${collection}"`).all()
            .map(row => ({ id: row.id, ...JSON.parse(row.data) }));
    }

    async findById(id, collection) {
        this._ensureTable(collection);
        const row = this.db.prepare(`SELECT id, data FROM "${collection}" WHERE id = ?`).get(id);
        if (!row) return null;
        return { id: row.id, ...JSON.parse(row.data) };
    }

    async insert(collection, item) {
        this._ensureTable(collection);
        const id = item.id || crypto.randomUUID();
        const { id: _removed, ...rest } = item;
        this.db.prepare(
            `INSERT OR REPLACE INTO "${collection}" (id, data) VALUES (?, ?)`
        ).run(id, JSON.stringify(rest));
        return { id, ...rest };
    }

    async deleteById(id, collection) {
        this._ensureTable(collection);
        const result = this.db.prepare(`DELETE FROM "${collection}" WHERE id = ?`).run(id);
        return result.changes > 0;
    }
}

module.exports = SqliteAdapter;
