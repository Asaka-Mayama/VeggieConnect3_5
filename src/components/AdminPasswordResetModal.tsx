import React, { useEffect, useState } from 'react';
import { X, KeyRound, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';

// ── Admin "Reset Password" mini-modal ────────────────────────────────────────
// The prototype's forgot-password flow (no email / SMS needed): a user who
// forgot their password requests a reset from the LOGIN page (contact + last
// password — the SERVER verifies it first), the account's PW button in the
// Users & KYC tab turns red, and the admin sets a temporary password here.
// Uses the EXACT same phone shell as the app's other full modals
// (VerificationReviewModal / ReportsPreviewModal) so it never overlaps.
interface Props {
  user: UserProfile;
  /** Pending forgot-password request for this account, if one exists. */
  pendingRequest?: { id: string; requestedAt?: string; contact?: string } | null;
  onClose: () => void;
  onDone: (successMessage: string) => void;
  onDismissRequest?: (requestId: string) => void;
}

export const AdminPasswordResetModal: React.FC<Props> = ({
  user,
  pendingRequest,
  onClose,
  onDone,
  onDismissRequest,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.trim().length < 6) {
      setError('The temporary password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch(`/api/users/${encodeURIComponent(user.id)}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPassword.trim() }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success) {
        setError(data?.error || 'Could not reset the password — is the server running?');
        setBusy(false);
        return;
      }
      onDone(data.message || `Temporary password set for ${user.name}.`);
    } catch (e) {
      setError('Could not reach the app server — check that the app is running.');
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-0 min-[460px]:p-4 bg-neutral-950/70 backdrop-blur-[2px]">
      {/* Same phone shell as the app itself (AdminApp frame): 430px wide,
          the same fixed height formula, 44px rounding and bezel border. */}
      <div className="w-full max-w-[430px] h-[100dvh] min-[460px]:h-[min(920px,calc(100dvh_-_2rem))] bg-white min-[460px]:rounded-[44px] min-[460px]:border-[10px] min-[460px]:border-neutral-800/10 min-[460px]:shadow-[0_20px_50px_rgba(0,0,0,0.12)] relative flex flex-col overflow-hidden">
        {/* Header (pinned) */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-4 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">
              Reset Password · DA Admin Console
            </p>
            <h3 className="text-sm font-black truncate mt-0.5">{user.name}</h3>
            <p className="text-[10px] text-emerald-100/90 mt-0.5">
              {user.role} · {user.phone}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-colors flex-shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-4 space-y-3">
          {pendingRequest && (
            <div className="rounded-2xl bg-rose-50 border border-rose-300 p-3">
              <p className="text-[11px] font-black text-rose-700 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Password reset requested from the login page
              </p>
              <p className="text-[10px] text-rose-600 mt-1 flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                <span>
                  The server already verified the "last password" the user entered — it matched this
                  account. Requested{' '}
                  {pendingRequest.requestedAt
                    ? new Date(pendingRequest.requestedAt).toLocaleString()
                    : ''}
                  {pendingRequest.contact ? ` · contact: ${pendingRequest.contact}` : ''}. Setting a
                  temporary password below resolves this request automatically.
                </span>
              </p>
            </div>
          )}

          <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3 text-[11px] text-sky-800">
            Set a <b>temporary password</b>, then tell the user what it is (in person or over the
            phone). No email or SMS is sent. Minimum 6 characters.
          </div>

          <label className="block">
            <span className="text-[11px] font-black text-neutral-900">New temporary password</span>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="at least 6 characters"
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-black text-neutral-900">Confirm it</span>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="type it again"
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-bold text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            {busy ? 'Saving…' : 'Set Temporary Password'}
          </button>

          <div className="flex items-center gap-2">
            {pendingRequest && onDismissRequest && (
              <button
                type="button"
                onClick={() => onDismissRequest(pendingRequest.id)}
                className="flex-1 py-2 rounded-xl border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
              >
                Dismiss request (no reset)
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-neutral-200 text-[11px] font-bold text-neutral-600 hover:bg-neutral-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
