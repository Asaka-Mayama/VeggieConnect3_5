/**
 * VeggieConnect — ephemeral MySQL server bootstrap (XAMPP replacement)
 *
 * Runs a real MySQL server as an unprivileged process on 127.0.0.1:3306,
 * seeded with veggie_connect3.sql (the same dump used with XAMPP/phpMyAdmin).
 *
 * Design notes:
 * - Idempotent: if something already answers on port 3306 it exits 0 so the
 *   dev script can proceed immediately.
 * - Binaries + datadir live under TMPDIR (redirected into the project so they
 *   survive sandbox restarts and are re-used via downloadBinaryOnce).
 * - libaio.so.1 is bundled in scripts/lib (MySQL binaries need it; the sandbox
 *   does not ship it and we have no root access to install it system-wide).
 * - The keep-alive child is spawned DETACHED so it survives this script
 *   exiting; it keeps mysqld running for the lifetime of the sandbox.
 * - If MySQL cannot start, we still exit 0 — server.ts degrades gracefully to
 *   in-memory mode so the app always comes up.
 */
'use strict';

const net = require('net');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 3306;
const ROOT = path.resolve(__dirname, '..');
const PROJECT_TMP = path.join(ROOT, '.mysql-tmp');
const LIB_DIR = path.join(__dirname, 'lib');
const KEEPALIVE = path.join(__dirname, 'mysql-keepalive.cjs');

function probePort(port, timeout = 1500) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    let done = false;
    const finish = (up) => {
      if (done) return;
      done = true;
      s.destroy();
      resolve(up);
    };
    s.setTimeout(timeout, () => finish(false));
    s.once('connect', () => finish(true));
    s.once('error', () => finish(false));
  });
}

async function main() {
  if (await probePort(PORT)) {
    console.log(`[mysql-helper] Port ${PORT} already serving — MySQL assumed running.`);
    process.exit(0);
  }

  fs.mkdirSync(PROJECT_TMP, { recursive: true });

  const child = spawn(process.execPath, [KEEPALIVE], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    env: {
      ...process.env,
      TMPDIR: PROJECT_TMP,
      TMP: PROJECT_TMP,
      LD_LIBRARY_PATH: `${LIB_DIR}:${process.env.LD_LIBRARY_PATH || ''}`,
    },
  });
  child.unref();

  // Wait up to 150s (first boot downloads the MySQL binary; later boots reuse it).
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      console.error(`[mysql-helper] keep-alive exited early (code ${child.exitCode}).`);
      break;
    }
    if (await probePort(PORT, 1000)) {
      console.log(`[mysql-helper] MySQL is up on 127.0.0.1:${PORT}.`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.error('[mysql-helper] MySQL not ready in time — continuing; app falls back to in-memory mode.');
  process.exit(0);
}

main();
