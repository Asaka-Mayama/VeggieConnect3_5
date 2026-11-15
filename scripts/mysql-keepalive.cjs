/**
 * VeggieConnect — MySQL keep-alive process.
 *
 * Started detached by scripts/start-mysql.js. Keeps a MySQL 8.4 server
 * running on 127.0.0.1:3306 with the veggie_connect3.sql dump loaded, so
 * server.ts can persist orders / transport jobs / chat messages exactly
 * like it did against XAMPP MySQL.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DUMP = path.join(ROOT, 'veggie_connect3.sql');

async function main() {
  const { createDB } = require('mysql-memory-server');

  const db = await createDB({
    port: 3306,
    username: 'root',
    dbName: 'veggie_connect3',
    initSQLFilePath: DUMP,
    logLevel: 'ERROR',
    downloadRetries: 3,
  });

  fs.writeFileSync(path.join(ROOT, 'data', '.mysql-info.json'), JSON.stringify({
    port: db.port,
    username: db.username,
    dbName: db.dbName,
    version: db.mysql && db.mysql.version,
    startedAt: new Date().toISOString(),
  }, null, 2));

  console.log(`[mysql-keepalive] MySQL ${db.mysql ? db.mysql.version : ''} up on 127.0.0.1:${db.port} (user ${db.username}, db ${db.dbName}).`);
  // Stay alive forever — the library shuts MySQL down when this process exits.
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error('[mysql-keepalive] Failed to start MySQL:', err && err.message ? err.message : err);
  process.exit(1);
});
