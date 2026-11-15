// ── Pending-signup self-heal queue ──────────────────────────────────────────
// When a registration is submitted while the backend is unreachable, the
// payload (including the password) is parked in localStorage and replayed
// automatically by ANY open VeggieConnect tab until the server confirms the
// account. This is what makes a registration survive a server restart or a
// temporary outage: the Admin Console tab (or the registering tab) re-posts
// it as soon as the backend answers again, and the account then appears in
// the Admin Desk's "Pending User Verifications" queue as normal.
//
// NOTE: the payload intentionally includes the password so the replayed
// account can actually log in after approval. It is removed from localStorage
// the moment the server confirms the registration.
//
// ── Pending-DELETION self-heal queue (Build v3.8) ───────────────────────────
// The mirror-image problem: when the Admin Desk deletes an account while the
// backend is unreachable, the fire-and-forget DELETE used to vanish into a
// .catch(() => {}) — the server never learned about it, and the very next
// users poll RESURRECTED the deleted account (it also kept blocking
// re-registration with the same name/phone/email). Deletions are now parked
// the same way signups are and replayed until the server confirms, so a
// deleted account stays deleted on every device.

const QUEUE_KEY = 'veggieconnect_pending_signups_v1';
const DELETIONS_KEY = 'veggieconnect_pending_deletions_v1';

/** Fired (same tab AND via storage events cross-tab) whenever the local
 * account registry changes, so the Admin Console updates instantly instead
 * of waiting for the next backend poll. */
export const REGISTRY_CHANGED_EVENT = 'veggieconnect:user-registry-changed';

export interface PendingSignup {
  payload: Record<string, any>;
  queuedAt: string;
}

export interface PendingDeletion {
  id: string;
  name?: string;
  queuedAt: string;
}

function safeParse(raw: string | null): any {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function readPendingSignups(): PendingSignup[] {
  const parsed = safeParse(localStorage.getItem(QUEUE_KEY));
  return Array.isArray(parsed) ? parsed.filter((p) => p && p.payload && p.payload.name) : [];
}

function writeQueue(queue: PendingSignup[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Could not save the pending signup queue', e);
  }
}

const nameKey = (n: any) => String(n || '').trim().toLowerCase();

export function queuePendingSignup(payload: Record<string, any>): void {
  const queue = readPendingSignups().filter((p) => nameKey(p.payload.name) !== nameKey(payload?.name));
  queue.push({ payload, queuedAt: new Date().toISOString() });
  writeQueue(queue);
}

export function removePendingSignup(name: string): void {
  writeQueue(readPendingSignups().filter((p) => nameKey(p.payload.name) !== nameKey(name)));
}

export function hasPendingSignupFor(name: string): boolean {
  return readPendingSignups().some((p) => nameKey(p.payload.name) === nameKey(name));
}

// ── Pending deletions ────────────────────────────────────────────────────────

export function readPendingDeletions(): PendingDeletion[] {
  const parsed = safeParse(localStorage.getItem(DELETIONS_KEY));
  return Array.isArray(parsed) ? parsed.filter((d) => d && d.id) : [];
}

function writeDeletions(queue: PendingDeletion[]): void {
  try {
    localStorage.setItem(DELETIONS_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Could not save the pending deletion queue', e);
  }
}

export function queuePendingDeletion(id: string, name?: string): void {
  const key = String(id || '').trim();
  if (!key) return;
  const queue = readPendingDeletions().filter((d) => d.id !== key);
  queue.push({ id: key, name: name || undefined, queuedAt: new Date().toISOString() });
  writeDeletions(queue);
}

export function removePendingDeletion(id: string): void {
  const key = String(id || '').trim();
  writeDeletions(readPendingDeletions().filter((d) => d.id !== key));
}

export function hasPendingDeletionFor(id: string): boolean {
  const key = String(id || '').trim();
  return readPendingDeletions().some((d) => d.id === key);
}

// ── Same-tab registry notifications ──────────────────────────────────────────
// localStorage `storage` events only fire in OTHER tabs — the tab that wrote
// the change hears nothing. The Admin Console therefore needs this explicit
// event to reflect a registration/deletion that happened in its own tab
// without waiting for the next backend poll.

export function announceRegistryUpsert(user: Record<string, any>): void {
  try {
    window.dispatchEvent(new CustomEvent(REGISTRY_CHANGED_EVENT, { detail: { action: 'upsert', user } }));
  } catch (e) {}
}

export function announceRegistryRemoval(id: string): void {
  try {
    window.dispatchEvent(new CustomEvent(REGISTRY_CHANGED_EVENT, { detail: { action: 'remove', id } }));
  } catch (e) {}
}

function announceSynced(name: string): void {
  try {
    window.dispatchEvent(new CustomEvent('veggieconnect:signup-synced', { detail: { name } }));
  } catch (e) {}
}

function announceDeleted(name: string): void {
  try {
    window.dispatchEvent(new CustomEvent('veggieconnect:user-deleted-synced', { detail: { name } }));
  } catch (e) {}
}

/**
 * Attempts ONE replay round over the queued registrations.
 * Returns the account names that are now confirmed on the server.
 */
export async function flushPendingSignups(): Promise<string[]> {
  const queue = readPendingSignups();
  const synced: string[] = [];
  for (const entry of queue) {
    const name = String(entry.payload?.name || '');
    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.payload),
      });
      const data = await resp.json().catch(() => ({} as any));
      if (resp.ok) {
        synced.push(name);
        removePendingSignup(name);
        announceSynced(name);
      } else if (resp.status === 400 && /already registered|already exists/i.test(String(data?.error || ''))) {
        // The server already knows this account (e.g. the replay ran twice, or
        // another device registered it first) — treat it as delivered.
        synced.push(name);
        removePendingSignup(name);
        announceSynced(name);
      } else if (resp.status === 400 || resp.status === 422) {
        // Permanent validation rejection — this payload can never succeed, so
        // drop it instead of retrying forever.
        removePendingSignup(name);
      }
      // 5xx / other errors → keep queued; the next round will retry.
    } catch (err) {
      // Backend still unreachable — stop this round early.
      break;
    }
  }
  return synced;
}

/** Replays queued account deletions until the server confirms each one. */
export async function flushPendingDeletions(): Promise<string[]> {
  const queue = readPendingDeletions();
  const deleted: string[] = [];
  for (const entry of queue) {
    try {
      const resp = await fetch(`/api/users/${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
      if (resp.ok) {
        deleted.push(entry.name || entry.id);
        removePendingDeletion(entry.id);
        announceDeleted(entry.name || entry.id);
      } else if (resp.status === 404) {
        // Already gone server-side (e.g. deleted from another device) — done.
        removePendingDeletion(entry.id);
      }
      // Other errors → keep queued; the next round will retry.
    } catch (err) {
      // Backend still unreachable — stop this round early.
      break;
    }
  }
  return deleted;
}

/** Starts a lightweight retry loop (every 10s) that lives while the tab does. */
export function startPendingSignupAutoFlush(): void {
  const w = window as any;
  if (w.__vcPendingSignupFlushStarted) return;
  w.__vcPendingSignupFlushStarted = true;
  const run = () => {
    flushPendingSignups().catch(() => {});
    flushPendingDeletions().catch(() => {});
  };
  run();
  setInterval(run, 10000);
}
