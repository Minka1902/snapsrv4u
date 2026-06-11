import * as http from 'http';

// ─── Database config ──────────────────────────────────────────────────────────

export interface MongoDbConfig {
    type: 'mongodb';
    uri?: string;
    name?: string;
}

export interface PostgresConfig {
    type: 'postgres';
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
}

export interface SqliteConfig {
    type: 'sqlite';
    filename?: string;
}

export type DbConfig = MongoDbConfig | PostgresConfig | SqliteConfig;

// ─── Auth & rate limit ────────────────────────────────────────────────────────

export interface AuthConfig {
    key: string;
}

export interface RateLimitConfig {
    max: number;
    windowMs: number;
}

// ─── Route config ─────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export type PropertyType =
    | 'number' | 'float' | 'id' | 'uuid'
    | 'string' | 'sentence' | 'paragraph'
    | 'date' | 'past' | 'future' | 'timestamp'
    | 'firstname' | 'lastname' | 'fullname' | 'username'
    | 'email' | 'avatar' | 'phone' | 'gender' | 'jobtitle' | 'bio'
    | 'url' | 'ipv4' | 'password' | 'useragent'
    | 'latitude' | 'longitude' | 'city' | 'country' | 'address' | 'zipcode'
    | 'company' | 'department' | 'catchphrase'
    | 'product' | 'price' | 'color'
    | 'boolean' | 'faker';

export interface PropertyConfig {
    type: PropertyType | string;
    min?: number;
    max?: number;
    zeros?: number;
    from?: string;
    to?: string;
    unique?: boolean;
    method?: string;
    options?: Record<string, unknown>;
}

export type DelayConfig = number | { min: number; max: number };

export interface RouteConfig {
    method?: HttpMethod;
    count?: number;
    properties?: Record<string, PropertyConfig> | 'person';
    collection?: string;
    delay?: DelayConfig;
    errorRate?: number;
    errorStatus?: number;
    auth?: AuthConfig | null;
    rateLimit?: RateLimitConfig;
    paginate?: boolean;
}

// ─── Config file schema ───────────────────────────────────────────────────────

export interface FileRouteConfig extends RouteConfig {
    path: string;
}

export interface ServerConfig extends ConstructorOptions {
    routes?: FileRouteConfig[];
}

// ─── Constructor ──────────────────────────────────────────────────────────────

export interface ConstructorOptions {
    port?: number;
    dbName?: string;
    db?: DbConfig;
    websocket?: boolean;
    socketio?: boolean;
    logLevel?: 'none' | 'basic' | 'verbose';
    auth?: AuthConfig;
    rateLimit?: RateLimitConfig;
}

// ─── Paginated response ───────────────────────────────────────────────────────

export interface PaginatedResponse<T = unknown> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ─── MockApiServer ────────────────────────────────────────────────────────────

declare class MockApiServer {
    port: number;
    app: import('express').Application;
    db: unknown;
    server?: http.Server;
    io?: unknown;
    wss?: unknown;

    constructor(options?: ConstructorOptions | number);

    /** Create a server from a plain config object (used by config-file / CLI mode). */
    static fromConfig(config: ServerConfig): MockApiServer;

    /** Pre-built 12-field person schema. */
    static readonly personSchema: Record<string, PropertyConfig>;

    /** Register a route. */
    addRoute(path: string, config: RouteConfig): void;

    /** Register a custom Socket.io / WebSocket event handler. */
    addSocketEvent(event: string, handler: (data: unknown, socket: unknown) => void): void;

    /** Start the HTTP server (and optionally Socket.io + WebSocket). */
    start(): Promise<http.Server>;

    /** Generate a single faker value. */
    generateValue(type: PropertyType | string, config?: Partial<PropertyConfig>): unknown;

    /** Generate an object matching the given properties schema. */
    generateObject(properties: Record<string, PropertyConfig>): Record<string, unknown>;
}

export default MockApiServer;
export = MockApiServer;
