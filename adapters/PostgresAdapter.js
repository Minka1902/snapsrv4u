const { Pool } = require('pg');

class PostgresAdapter {
    constructor({ connectionString, host = 'localhost', port = 5432, database = 'snapsrv4u', user = 'postgres', password = '' } = {}) {
        this.pool = new Pool(connectionString ? { connectionString } : { host, port, database, user, password });
    }

    async connect() {
        // Pool connects lazily; run a quick query to verify the connection.
        await this.pool.query('SELECT 1');
    }

    async _ensureTable(collection) {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS "${collection}" (
                id TEXT PRIMARY KEY,
                data JSONB NOT NULL
            )
        `);
    }

    async getCollection(collection) {
        await this._ensureTable(collection);
        const result = await this.pool.query(`SELECT id, data FROM "${collection}"`);
        return result.rows.map(row => ({ id: row.id, ...row.data }));
    }

    async findById(id, collection) {
        await this._ensureTable(collection);
        const result = await this.pool.query(`SELECT id, data FROM "${collection}" WHERE id = $1`, [id]);
        if (!result.rows.length) return null;
        const row = result.rows[0];
        return { id: row.id, ...row.data };
    }

    async insert(collection, item) {
        await this._ensureTable(collection);
        const id = item.id || require('crypto').randomUUID();
        const { id: _removed, ...rest } = item;
        await this.pool.query(
            `INSERT INTO "${collection}" (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
            [id, rest]
        );
        return { id, ...rest };
    }

    async deleteById(id, collection) {
        await this._ensureTable(collection);
        const result = await this.pool.query(`DELETE FROM "${collection}" WHERE id = $1`, [id]);
        return result.rowCount > 0;
    }
}

module.exports = PostgresAdapter;
