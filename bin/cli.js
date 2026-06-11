#!/usr/bin/env node
const path = require('path');
const MockApiServer = require('../index');

const configArg = process.argv[2] || 'snapsrv4u.config.js';
const configPath = path.resolve(process.cwd(), configArg);

let config;
try {
    config = require(configPath);
} catch {
    console.error(`[snapsrv4u] Could not load config file: ${configPath}`);
    console.error('Create a snapsrv4u.config.js file or pass a path as the first argument.');
    process.exit(1);
}

MockApiServer.fromConfig(config).start();
