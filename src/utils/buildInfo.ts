// ── Build handshake (client ↔ server) ────────────────────────────────────────
// WHY THIS EXISTS: the app is started with `tsx server.ts`. Unlike `tsx watch`
// (and unlike the Vite dev middleware, which reads the client source from disk
// on every request), a running server process does NOT pick up newer code from
// an extracted zip. That produced the invisible failure where the browser ran
// the new client while the API process was still the old build — e.g. the
// /api/users/:id/documents route simply did not exist and the Admin Console
// showed "Valid Government ID: Missing" for every fresh registration.
//
// The client now compares its own build against /api/health's build marker and
// BOTH UIs show a loud red banner when they differ.
import { useEffect, useState } from 'react';

export const CLIENT_BUILD = 'v4.12';

export interface ServerBuildInfo {
  serverBuild: string | null;
  mysqlConnected: boolean | null;
  mismatch: boolean;
}

export function useServerBuild(): ServerBuildInfo {
  const [serverBuild, setServerBuild] = useState<string | null>(null);
  const [mysqlConnected, setMysqlConnected] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setServerBuild(d && d.build ? String(d.build) : 'unknown');
        setMysqlConnected(d && d.xampp && typeof d.xampp.connected === 'boolean' ? d.xampp.connected : null);
      })
      .catch(() => {
        if (alive) setServerBuild(null);
      });
    return () => {
      alive = false;
    };
  }, []);
  return {
    serverBuild,
    mysqlConnected,
    mismatch: Boolean(serverBuild && serverBuild !== CLIENT_BUILD),
  };
}
