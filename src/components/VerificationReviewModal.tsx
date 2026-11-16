// DA Admin Console — "View Documents" modal for the Pending User
// Verifications queue. Shows the uploaded Valid Government ID (mandatory for
// both roles) plus the role-specific extras:
//   - Farmer: RSBSA Number (optional) → "DA Registered" badge when present
//   - Buyer : Small Business Proof (optional) → "Verified Business" badge
// The Admin can Approve / Reject directly from the modal or from the queue.
//
// SIZING: the modal renders in EXACTLY the same phone shell as the app itself
// (same 430px width, same height formula, same 44px rounding and bezel) so
// reviewing documents feels like viewing the applicant's registration screen.
// Documents render as the same 64×64 attached-document card the registration
// form shows — the admin sees the ID at the size the applicant sees it.
import React, { useEffect, useState } from 'react';
import {
  X,
  IdCard,
  FileImage,
  BadgeCheck,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { UserProfile } from '../types';
import { verificationStateOf } from '../utils/verification';

interface VerificationReviewModalProps {
  user: UserProfile | null;
  onClose: () => void;
  onApprove: (user: UserProfile) => void;
  onReject: (user: UserProfile) => void;
}

const hasImage = (v?: string): boolean =>
  Boolean(v && typeof v === 'string' && v.startsWith('data:image'));

/** Verification documents fetched lazily from the server for the reviewed
 *  account. The directory endpoints never ship ID photos, so the admin can
 *  review an applicant's documents from ANY device — the image stored in
 *  MySQL at registration is the source of truth. */
interface VerificationDocuments {
  validIdImage?: string;
  businessProofImage?: string;
  rsbsaNumber?: string;
}

export const VerificationReviewModal: React.FC<VerificationReviewModalProps> = ({
  user,
  onClose,
  onApprove,
  onReject,
}) => {
  // Close on Escape so the Admin can skim the queue with the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lazily fetch the uploaded documents for this applicant straight from the
  // server (MySQL is the source of truth). Fixes the bug where a Valid
  // Government ID uploaded on the applicant's device never appeared here —
  // the queue's directory copy deliberately carries no images.
  const [docs, setDocs] = useState<
    VerificationDocuments & {
      mysqlConnected?: boolean;
      found?: boolean;
      approvedAt?: string;
      approvedBy?: string;
      rejectedAt?: string;
      rejectedBy?: string;
    }
  | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  // Why the lookup came back empty: 'stale-server' = the documents route does
  // not exist (the RUNNING server process is an older build than this page),
  // 'unreachable' = the server did not answer at all.
  const [docsError, setDocsError] = useState<'stale-server' | 'unreachable' | null>(null);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setDocs(null);
    setDocsError(null);
    setDocsLoading(true);
    fetch(`/api/users/${encodeURIComponent(userId)}/documents`)
      .then((r) => {
        if (!r.ok) {
          if (alive) setDocsError(r.status === 404 ? 'stale-server' : 'unreachable');
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (alive) setDocs(d && typeof d === 'object' ? d : null);
      })
      .catch(() => {
        if (alive) setDocsError('unreachable');
      })
      .finally(() => {
        if (alive) setDocsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!user) return null;

  const isFarmer = user.role === 'farmer';
  const state = verificationStateOf(user);
  // The registry copy from registration day (same browser) and the server
  // copy (any device) are both accepted — the server wins only as a fill-in.
  const resolvedValidId = (user.validIdImage || docs?.validIdImage || '').trim();
  const resolvedBusinessProof = (user.businessProofImage || docs?.businessProofImage || '').trim();
  const resolvedRsbsa = ((user.rsbsaNumber || docs?.rsbsaNumber || '') as string).trim();
  const rsbsaProvided = Boolean(resolvedRsbsa);
  const businessProofProvided = hasImage(resolvedBusinessProof);
  const validIdProvided = hasImage(resolvedValidId);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-0 min-[460px]:p-4 bg-neutral-950/70 backdrop-blur-[2px]">
      {/* Same phone shell as the app itself (AdminApp frame): 430px wide,
          same height formula, 44px rounding and bezel border. */}
      <div className="w-full max-w-[430px] h-[100dvh] min-[460px]:h-[min(920px,calc(100dvh_-_2rem))] bg-white min-[460px]:rounded-[44px] min-[460px]:border-[10px] min-[460px]:border-neutral-800/10 min-[460px]:shadow-[0_20px_50px_rgba(0,0,0,0.12)] relative flex flex-col overflow-hidden">
        {/* Header (pinned, like the app's screen header) */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-4 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">
              Pending User Verification · DA Admin Console
            </p>
            <h3 className="text-sm font-black truncate mt-0.5">{user.name}</h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span
                className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                  isFarmer ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/40' : 'bg-sky-400/20 text-sky-100 border border-sky-300/40'
                }`}
              >
                {user.role}
              </span>
              {state === 'Pending' ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-amber-400/20 text-amber-100 border border-amber-300/40 flex items-center gap-1">
                  <Clock3 className="w-3 h-3" /> Pending Review
                </span>
              ) : state === 'Approved' ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-emerald-400/20 text-emerald-100 border border-emerald-300/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Approved
                </span>
              ) : (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-400/20 text-rose-100 border border-rose-300/40 flex items-center gap-1">
                  <ShieldX className="w-3 h-3" /> Rejected
                </span>
              )}
              {/* Automatic verification badges */}
              {isFarmer && rsbsaProvided && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-white text-emerald-800 flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> DA Registered
                </span>
              )}
              {!isFarmer && businessProofProvided && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-white text-sky-800 flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> Verified Business
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            id="btn-verification-close"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-colors flex-shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body (like an app screen) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Applicant summary */}
          <div className="grid grid-cols-1 gap-1.5 text-[11px] text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-2xl p-3">
            <p className="flex items-center gap-2">
              <UserIcon className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span className="font-bold">{user.name}</span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span className="font-mono">{user.phone}</span>
              {user.email && <span className="truncate text-neutral-500">· {user.email}</span>}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span className="truncate">{user.location}</span>
            </p>
            {isFarmer && user.farmName && (
              <p className="flex items-center gap-2 text-emerald-800">
                <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">🌱</span>
                <span className="font-bold">{user.farmName}</span>
              </p>
            )}
            {user.submittedAt && (
              <p className="text-[10px] text-neutral-400 font-mono">
                Submitted: {new Date(user.submittedAt).toLocaleString()}
              </p>
            )}
            {/* Verification audit trail — WHO decided and WHEN */}
            {(user.approvedAt || docs?.approvedAt) && (
              <p className="text-[10px] font-bold text-emerald-700">
                Approved by {user.approvedBy || docs?.approvedBy || 'DA Admin'} · {new Date(user.approvedAt || docs?.approvedAt!).toLocaleString()}
              </p>
            )}
            {(user.rejectedAt || docs?.rejectedAt) && (
              <p className="text-[10px] font-bold text-rose-700">
                Rejected by {user.rejectedBy || docs?.rejectedBy || 'DA Admin'} · {new Date(user.rejectedAt || docs?.rejectedAt!).toLocaleString()}
              </p>
            )}
          </div>

          {/* REQUIRED — Valid Government ID */}
          <div>
            <p className="text-[11px] font-black text-neutral-900 mb-1.5 flex items-center gap-1.5">
              <IdCard className="w-4 h-4 text-emerald-700" />
              Valid Government ID <span className="text-red-500">*</span>
              {!validIdProvided && !docsLoading && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  Missing
                </span>
              )}
            </p>
            {validIdProvided ? (
              /* Same attached-document card (64×64 object-cover thumbnail) as
                 the registration form's DocumentUploadField — the admin sees
                 the ID at the size the applicant sees it in the app. */
              <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2.5 p-2.5">
                  <img
                    src={resolvedValidId}
                    alt="Valid Government ID"
                    className="w-16 h-16 rounded-xl object-cover border border-neutral-200 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      Document attached
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                      Uploaded at registration — shown at the same size as in the app
                    </p>
                  </div>
                </div>
              </div>
            ) : docsLoading ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center text-[11px] text-neutral-500">
                Loading the uploaded Valid Government ID…
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-[11px] text-amber-700 space-y-1.5">
                {docsError === 'stale-server' ? (
                  <>
                    <p className="font-black text-red-700">
                      The RUNNING app server is an older build — it has no document lookup.
                    </p>
                    <p>
                      Fully stop the app (Ctrl+C in its terminal / close it), start it again from the
                      newest code folder, then hard-refresh this page (Ctrl+Shift+R). The uploaded ID
                      is safe in the database and will appear right after the restart.
                    </p>
                  </>
                ) : docsError === 'unreachable' ? (
                  <>
                    <p className="font-black text-red-700">
                      Could not reach the app server to load the uploaded documents.
                    </p>
                    <p>Check that the server is still running, then refresh this page.</p>
                  </>
                ) : (
                  <>
                    <p>
                      No Valid ID image is stored on the server for this account
                      {docs && typeof docs.mysqlConnected === 'boolean'
                        ? ` — XAMPP MySQL ${docs.mysqlConnected ? 'connected' : 'NOT connected (memory mode)'}`
                        : ''}
                      .
                    </p>
                    <p>
                      Accounts registered before documents were stored in the database always show
                      this note; ask the applicant to re-register or re-upload their ID.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Farmer — RSBSA Number */}
          {isFarmer && (
            <div
              className={`rounded-2xl border p-3 ${
                rsbsaProvided ? 'border-emerald-200 bg-emerald-50/60' : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              <p className="text-[11px] font-black text-neutral-900 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <FileImage className="w-4 h-4 text-emerald-700" />
                  RSBSA Number <span className="font-medium text-neutral-500">(Optional)</span>
                </span>
                {rsbsaProvided && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-emerald-700 text-white flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" /> DA Registered
                  </span>
                )}
              </p>
              <p className={`text-xs font-mono mt-1.5 ${rsbsaProvided ? 'text-emerald-900' : 'text-neutral-400'}`}>
                {rsbsaProvided ? resolvedRsbsa : 'Not provided — no automatic DA Registered badge'}
              </p>
            </div>
          )}

          {/* Buyer — Small Business Proof */}
          {!isFarmer && (
            <div>
              <p className="text-[11px] font-black text-neutral-900 mb-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <FileImage className="w-4 h-4 text-sky-700" />
                  Small Business Proof <span className="font-medium text-neutral-500">(Optional)</span>
                </span>
                {businessProofProvided && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-sky-700 text-white flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" /> Verified Business
                  </span>
                )}
              </p>
              {businessProofProvided ? (
                <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-2.5 p-2.5">
                    <img
                      src={resolvedBusinessProof}
                      alt="Small Business Proof"
                      className="w-16 h-16 rounded-xl object-cover border border-neutral-200 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        Document attached
                      </p>
                      <p className="text-[10px] text-neutral-500 mt-0.5">
                        Barangay Clearance / DTI / Business Permit — uploaded at registration
                      </p>
                    </div>
                  </div>
                </div>
              ) : docsLoading ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center text-[11px] text-neutral-500">
                  Checking for an uploaded business proof…
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-[11px] text-neutral-500">
                  {docsError === 'stale-server'
                    ? 'The RUNNING app server is an older build — restart it fully (Ctrl+C, start again) and refresh to load uploaded documents.'
                    : 'Not provided — optional Barangay Clearance / DTI / Business Permit for small businesses.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Decision bar (pinned at the bottom, like the app's bottom bar) */}
        <div className="p-4 flex-shrink-0 border-t border-neutral-100 bg-white">
          {state === 'Pending' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-verification-approve"
                onClick={() => onApprove(user)}
                className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Approve
              </button>
              <button
                type="button"
                id="btn-verification-reject"
                onClick={() => onReject(user)}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <ShieldX className="w-4 h-4" />
                Reject
              </button>
            </div>
          ) : (
            <div
              className={`rounded-2xl border p-3 text-[11px] font-bold text-center ${
                state === 'Approved'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {state === 'Approved'
                ? 'This account was approved — the applicant can now log in and trade.'
                : 'This registration was rejected — the account cannot log in.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
