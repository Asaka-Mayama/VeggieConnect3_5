// ── Registered-users registry (login screen's local account mirror) ─────────
// The login/register screen keeps a small localStorage registry of known
// accounts (`veggieconnect_registered_users_v9`) so duplicate name/phone/email
// checks work instantly on the register form.
//
// BUG THIS FILE FIXES: entries were only ever ADDED (on signup / on login) and
// never removed when the DA Admin deleted the account — the admin delete flow
// cleaned the server, MySQL and the admin's own user list but NOT this
// registry, so a deleted user's name/phone/email stayed blocked on the
// register screen forever with "already registered". These helpers centralize
// every read/write and add purging so deleted identities unblock immediately.

import { UserProfile } from '../types';

export const REGISTERED_USERS_KEY = 'veggieconnect_registered_users_v9';

export function normalizePhone(p?: string): string {
  if (!p) return '';
  return p.replace(/[\s\-\+\(\)]/g, '').replace(/^63/, '0');
}

const norm = (v: any) => String(v || '').trim().toLowerCase();

export function getRegisteredUsers(): UserProfile[] {
  try {
    const saved = localStorage.getItem(REGISTERED_USERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter((u) => u && u.name);
    }
  } catch (e) {
    console.error('Error loading registered users', e);
  }
  return [];
}

export function setRegisteredUsers(users: UserProfile[]): void {
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Could not save registered users', e);
  }
}

export function saveRegisteredUser(user: UserProfile): void {
  const users = getRegisteredUsers();
  setRegisteredUsers([...users.filter((u) => u.id !== user.id), user]);
}

/** Removes every registry entry that shares a deleted account's identity —
 * by id, and also by name/phone/email, because entries saved by older builds
 * can carry a different id than the account the server deleted. */
export function purgeRegisteredIdentity(match: {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
}): void {
  const users = getRegisteredUsers();
  const kept = users.filter((u) => {
    if (match.id && u.id === match.id) return false;
    if (match.name && norm(u.name) && norm(u.name) === norm(match.name)) return false;
    if (match.phone && norm(u.phone) && normalizePhone(u.phone) === normalizePhone(match.phone)) return false;
    if (match.email && norm(u.email) && norm(u.email) === norm(match.email)) return false;
    return true;
  });
  if (kept.length !== users.length) {
    setRegisteredUsers(kept);
  }
}

/** Server-truth filter for the register screen's duplicate check.
 *
 * `candidates` are the registry entries that collide with the identity being
 * registered. The registry can be STALE (accounts the DA Admin deleted were
 * never removed), so before blocking a registration we confirm against the
 * fresh /api/users list: entries the server no longer knows are purged from
 * the registry and dropped, entries the server still knows are returned as
 * real duplicates.
 *
 * When `serverUsers` is not an array (request failed / offline), the
 * candidates are returned unchanged so the local behaviour is preserved. */
export function filterServerKnownUsers(candidates: UserProfile[], serverUsers: any[]): UserProfile[] {
  if (!Array.isArray(serverUsers)) return candidates;

  const serverIds = new Set(serverUsers.map((u) => String(u?.id ?? '')));
  const serverNames = new Set(serverUsers.map((u) => norm(u?.name)).filter(Boolean));
  const serverPhones = new Set(serverUsers.map((u) => normalizePhone(u?.phone)).filter(Boolean));
  const serverEmails = new Set(serverUsers.map((u) => norm(u?.email)).filter(Boolean));

  const stillKnown = candidates.filter((u) => {
    if (u.id && serverIds.has(String(u.id))) return true;
    if (norm(u.name) && serverNames.has(norm(u.name))) return true;
    if (normalizePhone(u.phone) && serverPhones.has(normalizePhone(u.phone))) return true;
    if (norm(u.email) && serverEmails.has(norm(u.email))) return true;
    return false;
  });

  const stale = candidates.filter((u) => !stillKnown.includes(u));
  if (stale.length > 0) {
    const staleIds = new Set(stale.map((u) => u.id));
    setRegisteredUsers(getRegisteredUsers().filter((u) => !staleIds.has(u.id)));
  }
  return stillKnown;
}
