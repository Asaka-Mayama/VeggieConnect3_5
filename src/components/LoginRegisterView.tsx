import React, { useState } from 'react';
import {
  Sprout,
  ShoppingBag,
  Lock,
  Phone,
  Mail,
  MapPin,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Shield,
  IdCard,
  ImagePlus,
  FileImage,
  Trash2,
  Clock3,
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import {
  getRegisteredUsers,
  saveRegisteredUser,
  filterServerKnownUsers,
  normalizePhone,
} from '../utils/registeredUsers';
import { AddressMapPickerModal } from './AddressMapPickerModal';
import { ThemeToggleButton } from './ThemeToggleButton';
import { fileToChatPhotoDataUrl } from '../utils/chatImage';
import { describeDocFileError, isValidRsbsaNumber, RSBSA_FORMAT_HINT } from '../utils/verification';
import { CLIENT_BUILD, useServerBuild } from '../utils/buildInfo';

interface LoginRegisterViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

interface DocumentUploadFieldProps {
  inputId: string;
  label: string;
  required?: boolean;
  helperText?: string;
  /** Error shown under the field (file type/size validation). */
  error?: string | null;
  /** Compressed data URL of the picked photo — drives the preview thumbnail. */
  preview: string;
  onPickFile: (file: File | null) => void;
  onRemove: () => void;
  /** Green (farmer scope) vs blue (buyer scope) accent for the selected state. */
  tone?: 'farmer' | 'buyer' | 'neutral';
}

// Shared upload tile for the registration documents (Valid ID / Business
// Proof). Accepts .jpg/.jpeg/.png up to 5MB and shows a preview thumbnail
// once a photo has been selected.
const DocumentUploadField: React.FC<DocumentUploadFieldProps> = ({
  inputId,
  label,
  required,
  helperText,
  error,
  preview,
  onPickFile,
  onRemove,
  tone = 'neutral',
}) => {
  const toneClasses =
    tone === 'farmer'
      ? 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-500'
      : tone === 'buyer'
      ? 'border-sky-300 bg-sky-50/40 hover:border-sky-500'
      : 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-500';

  return (
    <div>
      <label className="block text-xs font-semibold text-emerald-950 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {preview ? (
        <div className="relative rounded-2xl border border-emerald-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2.5 p-2.5">
            <img
              src={preview}
              alt={`${label} preview`}
              className="w-16 h-16 rounded-xl object-cover border border-neutral-200 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                Document attached
              </p>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                .jpg / .jpeg / .png — max 5MB · ready for DA review
              </p>
              <button
                type="button"
                id={`${inputId}-remove`}
                onClick={onRemove}
                className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-bold cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove photo</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex items-center gap-2.5 w-full rounded-2xl border border-dashed py-3 px-3 cursor-pointer transition-colors ${toneClasses}`}
        >
          <span className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0">
            <ImagePlus className="w-4.5 h-4.5 text-emerald-600" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-bold text-neutral-800">
              Upload photo (.jpg / .jpeg / .png)
            </span>
            <span className="block text-[10px] text-neutral-500 mt-0.5">
              {helperText || 'Tap to choose a clear photo — max 5MB'}
            </span>
          </span>
        </label>
      )}

      <input
        id={inputId}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
          onPickFile(file);
          // Allow re-picking the same file after a removal.
          e.target.value = '';
        }}
      />

      {error && (
        <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
};

export const LoginRegisterView: React.FC<LoginRegisterViewProps> = ({
  onLoginSuccess,
}) => {
  // Registered users come from the shared registry util
  // (src/utils/registeredUsers.ts) so deletions can purge stale entries.

  const [activeTab, setActiveTab] = useState<'intro' | 'login' | 'register'>('intro');
  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');

  // Build handshake: warn loudly when the RUNNING server process is an older
  // build than this page (the classic "extracted a new zip but never restarted
  // the server" case — new UI, old API, documents silently missing).
  const { serverBuild, mismatch } = useServerBuild();

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Forgot-password flow (login page → DA Admin Console) ──────────────────
  // The user enters the mobile number or email on the account plus the LAST
  // password they remember. The server verifies that password before the
  // request reaches the admin — only then does the account's PW button in
  // the Admin Console turn red.
  const [showForgot, setShowForgot] = useState(false);
  const [fpContact, setFpContact] = useState('');
  const [fpLastPassword, setFpLastPassword] = useState('');
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpSuccess, setFpSuccess] = useState<string | null>(null);
  const [fpBusy, setFpBusy] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLocation, setRegLocation] = useState('Dumaguete City, Negros Oriental');
  const [regFarmName, setRegFarmName] = useState('');
  const [regError, setRegError] = useState<string | null>(null);

  // Account that was just submitted for DA verification. When set, the
  // register tab shows a "Registration Submitted" success screen INSTEAD of
  // logging the user in — the DA Admin must approve the registration (after
  // reviewing the documents) before the account can log in at all.
  const [submittedUser, setSubmittedUser] = useState<UserProfile | null>(null);

  // DA verification documents:
  //  - Valid Government ID  — REQUIRED for BOTH roles (jpg/jpeg/png ≤ 5MB)
  //  - RSBSA Number         — Farmer only, OPTIONAL (validated only when filled)
  //  - Small Business Proof — Buyer only, OPTIONAL (Barangay Clearance / DTI / Permit)
  const [regValidIdPreview, setRegValidIdPreview] = useState('');
  const [regValidIdError, setRegValidIdError] = useState<string | null>(null);
  const [regRsbsa, setRegRsbsa] = useState('');
  const [regBusinessProofPreview, setRegBusinessProofPreview] = useState('');
  const [regBusinessProofError, setRegBusinessProofError] = useState<string | null>(null);
  const [isCompressingDoc, setIsCompressingDoc] = useState(false);

  const pickDocument = async (
    file: File | null,
    setPreview: (v: string) => void,
    setError: (v: string | null) => void
  ) => {
    if (!file) return;
    const fileError = describeDocFileError(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    setError(null);
    setIsCompressingDoc(true);
    try {
      // Downscale to a bandwidth-friendly JPEG data URL so the document
      // survives localStorage, the in-memory API store and the XAMPP MySQL
      // LONGTEXT columns without bloating the payload.
      const dataUrl = await fileToChatPhotoDataUrl(file, 1280, 0.78);
      setPreview(dataUrl);
    } catch (e: any) {
      setError(e?.message || 'Could not read the selected image.');
    } finally {
      setIsCompressingDoc(false);
    }
  };

  // MAP-REQUIRED REGISTRATION: the account can ONLY be created after the user
  // pins their exact location on the Google Map. A typed address alone is not
  // accepted — "set location first on the map, then create the account".
  const [pinnedLocation, setPinnedLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [showRegMap, setShowRegMap] = useState(false);
  const continueSignupAfterPinRef = React.useRef(false);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const identifier = loginIdentifier.trim().toLowerCase();
    if (!identifier) {
      setLoginError('Please enter your mobile phone number or email.');
      return;
    }

    if (identifier === 'admin' || identifier === 'admin@gmail.com' || identifier === 'admin desk') {
      setLoginError('incorrect password or username');
      return;
    }

    if (!loginPassword) {
      setLoginError('incorrect password or username');
      return;
    }

    setIsSubmitting(true);

    try {
      // Try backend authentication
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: identifier,
          email: identifier,
          password: loginPassword,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        // Pending / Rejected registrations get their dedicated explainer from
        // the server — the DA Admin approves the registration BEFORE the
        // account may log in. Every other failure keeps the original
        // generic login error.
        if (data?.status === 'pending_verification' || data?.status === 'rejected') {
          setLoginError(data.error);
        } else {
          setLoginError('incorrect password or username');
        }
        setIsSubmitting(false);
        return;
      }

      if (data.user) {
        if (data.user.role === 'admin') {
          setLoginError('incorrect password or username');
          setIsSubmitting(false);
          return;
        }
        saveRegisteredUser(data.user);
        onLoginSuccess(data.user);
        return;
      }
    } catch (err) {
      console.log('Backend login unreachable:', err);
      setLoginError('incorrect password or username');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Forgot-password request (login page) ──────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError(null);
    setFpSuccess(null);
    if (!fpContact.trim() || !fpLastPassword) {
      setFpError('Enter the mobile number or email on your account AND the last password you remember.');
      return;
    }
    setFpBusy(true);
    try {
      const resp = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: fpContact.trim(), lastPassword: fpLastPassword }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success) {
        setFpError(data?.error || 'Could not send the request — is the app server running?');
      } else {
        setFpSuccess(data.message);
        setFpContact('');
        setFpLastPassword('');
      }
    } catch (err) {
      console.log('Reset request unreachable:', err);
      setFpError('Could not reach the app server — check that the app is running.');
    }
    setFpBusy(false);
  };

  // Handle Registration
  // Auto-capitalize: "juan dela cruz" is stored as "Juan Dela Cruz" — the
  // first letter of every lowercase word is capitalized in the details.
  const titleCaseWords = (v: string) =>
    v
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');

  const createAccount = async (pin: { address: string; lat: number; lng: number }) => {
    setIsSubmitting(true);

    const trimmedName = titleCaseWords(regName);
    const rawPhone = regPhone.trim();
    const rawEmail = rawEmailSafe(regEmail.trim());

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      name: trimmedName,
      email: rawEmail || `${trimmedName.toLowerCase().replace(/\s+/g, '')}@dgte-agri.ph`,
      phone: rawPhone,
      role: selectedRole,
      // Location comes strictly from the confirmed map pin (never a typed guess)
      location: pin.address,
      latitude: pin.lat,
      longitude: pin.lng,
      farmName: selectedRole === 'farmer' ? titleCaseWords(regFarmName) : undefined,
      avatar: '',
      // DA verification workflow: NO immediate transactional access. The
      // account enters the Admin Console's Pending User Verifications queue
      // and only an explicit Approve unlocks harvesting / ordering.
      verificationStatus: 'Pending',
      submittedAt: new Date().toISOString(),
      validIdImage: regValidIdPreview,
      rsbsaNumber: selectedRole === 'farmer' ? regRsbsa.trim() : undefined,
      businessProofImage: selectedRole === 'buyer' ? regBusinessProofPreview : undefined,
      verified: false,
      status: 'active',
    };

    // The backend is the single source of truth for the account identity.
    // Continue the session with the account the SERVER actually stored — its id
    // is what every crop listing, order and chat will be linked to.
    let registeredUser: UserProfile = newUser;
    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newUser,
          password: regPassword,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setRegError(data.error || 'Failed to register account.');
        setIsSubmitting(false);
        return;
      }

      if (data.user && data.user.id) {
        registeredUser = data.user;
      }
    } catch (err) {
      console.log('Backend signup notice:', err);
    } finally {
      setIsSubmitting(false);
    }

    // DO NOT log the user in. The registration is only a submission — the
    // DA Admin checks the uploaded documents in the Admin Console and the
    // account can log in ONLY after an explicit Approve.
    saveRegisteredUser(registeredUser);
    setSubmittedUser(registeredUser);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const trimmedName = regName.trim();
    const rawPhone = regPhone.trim();
    const rawEmail = rawEmailSafe(regEmail.trim());
    const normName = trimmedName.toLowerCase();
    const normPhone = normalizePhone(rawPhone);
    const normEmail = rawEmail.toLowerCase();

    if (!trimmedName) {
      setRegError('Please enter your full name.');
      return;
    }
    if (!rawPhone) {
      setRegError('Please enter your active Mobile No.');
      return;
    }
    if (!regPassword.trim()) {
      setRegError('Please choose a password.');
      return;
    }
    if (selectedRole === 'farmer' && !regFarmName.trim()) {
      setRegError('Please enter your Farm name.');
      return;
    }

    // MANDATORY VERIFICATION FIELD (both roles): a Valid Government ID photo
    // must be attached before the registration can be submitted for review.
    if (!regValidIdPreview) {
      setRegError('A Valid Government ID photo is required — upload a clear .jpg/.jpeg/.png image (max 5MB) to submit your registration.');
      return;
    }

    // Farmer role-specific: RSBSA Number is OPTIONAL — the format is only
    // validated when the farmer actually types something in.
    if (selectedRole === 'farmer' && regRsbsa.trim() && !isValidRsbsaNumber(regRsbsa)) {
      setRegError(`The RSBSA Number looks invalid. ${RSBSA_FORMAT_HINT}, or leave the field empty.`);
      return;
    }

    // Local Duplicate Validations across all existing users
    let existingUsers = getRegisteredUsers();

    // Find every locally known account that collides with the requested
    // identity. The local registry can be STALE: accounts deleted by the DA
    // Admin used to stay in it forever, which blocked re-registering the same
    // name/phone/email with "already registered" even though the account was
    // gone from the server. The server is the source of truth — before
    // blocking, confirm each candidate still exists server-side and purge the
    // stale entries it no longer knows about.
    const localDupes = existingUsers.filter(
      (u) =>
        (u.name && u.name.trim().toLowerCase() === normName) ||
        (!!normPhone && u.phone && normalizePhone(u.phone) === normPhone) ||
        (!!normEmail && u.email && u.email.trim().toLowerCase() === normEmail)
    );
    if (localDupes.length > 0) {
      try {
        const serverCheck = await fetch('/api/users');
        if (serverCheck.ok) {
          const serverUsers = await serverCheck.json();
          existingUsers = filterServerKnownUsers(localDupes, serverUsers);
        }
      } catch {
        // Server unreachable — fall back to the local registry as-is.
      }
    }

    // Check duplicate name
    const dupName = existingUsers.find((u) => u.name && u.name.trim().toLowerCase() === normName);
    if (dupName) {
      setRegError(`An account with the name "${trimmedName}" is already registered. Please use a unique full name.`);
      return;
    }

    // Check duplicate phone
    if (normPhone) {
      const dupPhone = existingUsers.find((u) => u.phone && normalizePhone(u.phone) === normPhone);
      if (dupPhone) {
        setRegError(`An account with the mobile number "${rawPhone}" is already registered.`);
        return;
      }
    }

    // Check duplicate email
    if (normEmail) {
      const dupEmail = existingUsers.find((u) => u.email && u.email.trim().toLowerCase() === normEmail);
      if (dupEmail) {
        setRegError(`An account with the email "${rawEmail}" is already registered.`);
        return;
      }
    }

    // REQUIREMENT: the user must set their location on the map FIRST.
    // No account is ever created from a typed address alone — open the
    // map picker now and continue signup automatically after the pin is
    // confirmed.
    if (!pinnedLocation) {
      continueSignupAfterPinRef.current = true;
      setShowRegMap(true);
      setRegError('Please pin your exact location on the map to create your account.');
      return;
    }

    await createAccount(pinnedLocation);
  };

  function rawEmailSafe(str: string) {
    return str || '';
  }

  // 1. INTRODUCTION / GET STARTED APP SPLASH SCREEN (PURE GREEN APP BACKGROUND)
  if (activeTab === 'intro') {
    return (
      <div className="relative min-h-[580px] sm:min-h-[720px] flex-1 flex flex-col justify-between p-6 overflow-hidden text-white select-none bg-gradient-to-b from-emerald-700 via-emerald-800 to-emerald-950">
        {/* Per-role dark mode toggle (guest scope before logging in) */}
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggleButton id="btn-intro-theme-toggle" tone="dark" />
        </div>
        {/* Decorative Ambient Green Lighting Effects */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/30 blur-3xl" />
          <div className="absolute top-1/3 -left-16 w-64 h-64 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="absolute -bottom-20 right-0 w-80 h-80 rounded-full bg-emerald-600/20 blur-3xl" />
        </div>

        {/* Top App Header Pill */}
        <div className="relative z-10 pt-2 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[11px] font-bold tracking-wide text-emerald-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Direct Agricultural Network</span>
          </div>

          <span className="text-[10px] font-extrabold text-emerald-100 bg-emerald-950/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-emerald-400/20">
            Negros Oriental
          </span>
        </div>

        {/* Center Hero Showcase */}
        <div className="relative z-10 py-6 my-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-2xl shadow-emerald-950/80 border border-white/30">
            <Sprout className="w-9 h-9 stroke-[2.3]" />
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-white font-display drop-shadow-md leading-tight">
              Veggie<span className="text-emerald-300">Connect</span>
            </h1>
            <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest">
              Direct Vegetable Market App
            </p>
          </div>

          <p className="text-sm text-emerald-50 leading-relaxed font-medium max-w-xs drop-shadow-sm">
            Your platform to buy or sell fresh vegetables in bulk across Negros Oriental. From easy ordering and managed deliveries to price checks with DA Bantay Presyo, we make wholesale trading simple for everyone.
          </p>
        </div>

        {/* Bottom Call to Actions */}
        <div className="relative z-10 space-y-2.5 pt-4">
          <button
            id="btn-intro-get-started"
            onClick={() => {
              setActiveTab('register');
              setSubmittedUser(null);
              setLoginError(null);
              setRegError(null);
            }}
            className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-950/70 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>

          <button
            id="btn-intro-login"
            onClick={() => {
              setActiveTab('login');
              setSubmittedUser(null);
              setLoginError(null);
              setRegError(null);
            }}
            className="w-full py-3 px-4 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-2xl backdrop-blur-md border border-white/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
          >
            <span>I already have an account · Log In</span>
          </button>
        </div>

      </div>
    );
  }

  return (
    <>
    <div className="relative min-h-full flex flex-col justify-center px-4 py-8 max-w-md mx-auto w-full text-neutral-900 bg-[#f4f9f4]">
      {/* Per-role dark mode toggle (guest scope before logging in) */}
      <div className="absolute top-3 right-3 z-20">
        <ThemeToggleButton id="btn-auth-theme-toggle" />
      </div>
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-700/20 text-white mb-3">
          <Sprout className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-emerald-950 font-display">
          Veggie<span className="text-emerald-600">Connect</span>
        </h1>
        <p className="text-xs text-emerald-800/80 font-medium mt-1">
          Direct Farmer & Buyer Network (Negros Oriental)
        </p>
      </div>

      {/* Login vs Register Tab Selector */}
      <div className="bg-emerald-100/60 p-1 rounded-2xl border border-emerald-200/80 flex mb-5">
        <button
          id="tab-login"
          onClick={() => {
            setActiveTab('login');
            setSubmittedUser(null);
            setLoginError(null);
            setRegError(null);
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'login'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-900/70 hover:text-emerald-950'
          }`}
        >
          Log In
        </button>
        <button
          id="tab-register"
          onClick={() => {
            setActiveTab('register');
            setSubmittedUser(null);
            setLoginError(null);
            setRegError(null);
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'register'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-900/70 hover:text-emerald-950'
          }`}
        >
          Register (New User)
        </button>
      </div>

      {/* LOGIN FORM */}
      {activeTab === 'login' && !showForgot && (
        <form onSubmit={handleLogin} className="space-y-4 bg-white border border-emerald-100/90 rounded-3xl p-5 shadow-sm">
          <div className="border-b border-emerald-100 pb-3">
            <h2 className="text-base font-bold text-emerald-950">Log in to your account</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Enter your registered phone number or email address
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1">
              Mobile Number or Email
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
              <input
                id="input-login-id"
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="0917 123 4567 or email"
                className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-neutral-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
              <input
                id="input-login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-neutral-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            id="btn-submit-login"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2 cursor-pointer"
          >
            <span>{isSubmitting ? 'Logging in...' : 'Log In to VeggieConnect'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center">
            <button
              id="btn-forgot-password"
              type="button"
              onClick={() => {
                setShowForgot(true);
                setFpError(null);
                setFpSuccess(null);
                setLoginError(null);
              }}
              className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-neutral-500">
              Need a new member account?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setSubmittedUser(null);
                  setLoginError(null);
                }}
                className="text-emerald-700 hover:underline font-bold cursor-pointer"
              >
                Register here
              </button>
            </p>
          </div>
        </form>
      )}

      {/* FORGOT PASSWORD FORM (login page flow → DA Admin Console) */}
      {activeTab === 'login' && showForgot && (
        <form onSubmit={handleForgotPassword} className="space-y-4 bg-white border border-emerald-100/90 rounded-3xl p-5 shadow-sm">
          <div className="border-b border-emerald-100 pb-3">
            <h2 className="text-base font-bold text-emerald-950">Forgot your password?</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Enter the mobile number or email on your account and the LAST password you remember. The server
              checks that password first — if it matches, the DA Admin gets your request and will set a
              temporary password for you.
            </p>
          </div>

          {fpError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{fpError}</span>
            </div>
          )}
          {fpSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{fpSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1">
              Mobile Number or Email
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
              <input
                id="input-forgot-contact"
                type="text"
                value={fpContact}
                onChange={(e) => setFpContact(e.target.value)}
                placeholder="0917 123 4567 or email"
                className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-neutral-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1">
              The Last Password You Know
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
              <input
                id="input-forgot-last-password"
                type="password"
                value={fpLastPassword}
                onChange={(e) => setFpLastPassword(e.target.value)}
                placeholder="Your previous password"
                className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-neutral-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <button
            id="btn-request-password-reset"
            type="submit"
            disabled={fpBusy}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2 cursor-pointer"
          >
            <span>{fpBusy ? 'Sending request...' : 'Request Password Reset'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForgot(false);
                setFpError(null);
                setFpSuccess(null);
              }}
              className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              ← Back to Log In
            </button>
          </div>
        </form>
      )}

      {/* REGISTRATION FORM */}
      {activeTab === 'register' && !submittedUser && (
        <form onSubmit={handleRegister} className="space-y-4 bg-white border border-emerald-100/90 rounded-3xl p-5 shadow-sm">
          <div className="border-b border-emerald-100 pb-3">
            <h2 className="text-base font-bold text-emerald-950">Create New Account</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Select whether you are a Farmer or a Buyer
            </p>
          </div>

          {regError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{regError}</span>
            </div>
          )}

          {/* Role Selection: Farmer vs Buyer */}
          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1.5">
              Select Your Role
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                id="role-select-farmer"
                onClick={() => setSelectedRole('farmer')}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  selectedRole === 'farmer'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs ring-2 ring-emerald-600'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <div className="text-2xl mb-1">👨‍🌾</div>
                <div className="text-xs font-bold leading-tight">Farmer</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">Grower / Mag-uuma</div>
              </button>

              <button
                type="button"
                id="role-select-buyer"
                onClick={() => setSelectedRole('buyer')}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  selectedRole === 'buyer'
                    ? 'bg-sky-50 border-sky-600 text-sky-900 shadow-xs ring-2 ring-sky-600'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <div className="text-2xl mb-1">🛒</div>
                <div className="text-xs font-bold leading-tight">Buyer</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">Customer / Mamalitay</div>
              </button>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
              <input
                id="input-reg-name"
                type="text"
                placeholder="e.g. Juan dela Cruz"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                required
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1">
              Mobile No. <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
              <input
                id="input-reg-phone"
                type="text"
                placeholder="+63 917 123 4567"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                required
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
              <input
                id="input-reg-email"
                type="email"
                placeholder="juan@gmail.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-emerald-950 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
              <input
                id="input-reg-password"
                type="password"
                placeholder="Create password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                required
              />
            </div>
          </div>

          {/* Location — REQUIRED: must be pinned on the map before account creation */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-emerald-950">
                Location / Municipality
              </label>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  pinnedLocation
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {pinnedLocation ? '✓ Pinned on Map' : 'Map Pin Required'}
              </span>
            </div>
            <button
              id="btn-open-reg-map"
              type="button"
              onClick={() => {
                continueSignupAfterPinRef.current = false;
                setShowRegMap(true);
              }}
              className="w-full bg-emerald-50/40 border border-emerald-200 hover:border-emerald-500 rounded-xl py-2.5 pl-9 pr-3 text-left text-xs text-neutral-900 transition-colors cursor-pointer relative"
              title="Open the map to pin your exact location"
            >
              <MapPin className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
              <span className={`block truncate ${pinnedLocation ? 'font-semibold' : 'text-neutral-500'}`}>
                {pinnedLocation
                  ? pinnedLocation.address
                  : `${regLocation} — tap to pin on map`}
              </span>
            </button>
            <p className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0" />
              Required: set your exact location on the map before creating your account
            </p>
          </div>

          {/* MANDATORY VERIFICATION DOCUMENT — Valid Government ID (both roles).
              Placed directly below Location / Municipality per the DA spec. */}
          <DocumentUploadField
            inputId="input-reg-valid-id"
            label="Valid Government ID"
            required
            tone={selectedRole === 'buyer' ? 'buyer' : 'farmer'}
            helperText={
              isCompressingDoc
                ? 'Processing photo…'
                : 'Required: clear photo of a government ID (.jpg/.jpeg/.png, max 5MB)'
            }
            preview={regValidIdPreview}
            error={regValidIdError}
            onPickFile={(file) => pickDocument(file, setRegValidIdPreview, setRegValidIdError)}
            onRemove={() => {
              setRegValidIdPreview('');
              setRegValidIdError(null);
            }}
          />
          <p className="-mt-2 text-[10px] text-neutral-500 flex items-start gap-1">
            <IdCard className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>
              Your registration will be reviewed by the DA Admin. You can log in only after the admin has verified your documents and approved your registration.
            </span>
          </p>

          {/* Role-specific fields */}
          {selectedRole === 'farmer' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-emerald-800 mb-1">
                  Farm Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Sprout className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
                  <input
                    id="input-reg-farm"
                    type="text"
                    placeholder="e.g. Valencia Highland Organic Farm"
                    value={regFarmName}
                    onChange={(e) => setRegFarmName(e.target.value)}
                    className="w-full bg-emerald-50/40 border border-emerald-300 rounded-xl py-2.5 pl-9 pr-3 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                    required
                  />
                </div>
              </div>

              {/* RSBSA Number — OPTIONAL: only validated when a value is entered */}
              <div>
                <label className="block text-xs font-semibold text-emerald-800 mb-1">
                  RSBSA Number (Optional)
                </label>
                <div className="relative">
                  <FileImage className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
                  <input
                    id="input-reg-rsbsa"
                    type="text"
                    placeholder="e.g. 07-46-10-001-000001 (Optional)"
                    value={regRsbsa}
                    onChange={(e) => setRegRsbsa(e.target.value)}
                    className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  Registry Number for Basic Sector in Agriculture — earn a <span className="font-bold">“DA Registered”</span> badge once approved
                </p>
              </div>
            </>
          )}

          {selectedRole === 'buyer' && (
            <DocumentUploadField
              inputId="input-reg-business-proof"
              label="Small Business Proof (Optional)"
              tone="buyer"
              helperText={
                isCompressingDoc
                  ? 'Processing photo…'
                  : 'Optional: Barangay Clearance, DTI, or Business Permit for small businesses'
              }
              preview={regBusinessProofPreview}
              error={regBusinessProofError}
              onPickFile={(file) => pickDocument(file, setRegBusinessProofPreview, setRegBusinessProofError)}
              onRemove={() => {
                setRegBusinessProofPreview('');
                setRegBusinessProofError(null);
              }}
            />
          )}

          <button
            id="btn-submit-register"
            type="submit"
            disabled={isSubmitting || isCompressingDoc}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span>
              {isSubmitting
                ? 'Submitting Registration…'
                : isCompressingDoc
                ? 'Processing document…'
                : 'Submit Registration for Verification'}
            </span>
            <Clock3 className="w-4 h-4" />
          </button>

          <p className="text-center text-[10px] text-neutral-500 -mt-1.5">
            <Shield className="w-3 h-3 inline text-emerald-600" /> You can log in only after the DA Admin verifies your Valid ID and approves your registration.
          </p>

          <div className="text-center pt-2">
            <p className="text-xs text-neutral-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setSubmittedUser(null);
                  setRegError(null);
                }}
                className="text-emerald-700 hover:underline font-bold cursor-pointer"
              >
                Log in here
              </button>
            </p>
          </div>
        </form>
      )}

      {/* REGISTRATION SUBMITTED — success screen (NO auto-login).
          The DA Admin reviews the uploaded documents in the Admin Console's
          Pending User Verifications queue and the account can log in ONLY
          after the admin approves it. */}
      {activeTab === 'register' && submittedUser && (
        <div className="space-y-3.5 bg-white border border-emerald-100/90 rounded-3xl p-5 shadow-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-black text-emerald-950">Registration Submitted</h2>
            <p className="text-xs text-neutral-600 leading-relaxed mt-1">
              Thank you, <span className="font-bold">{submittedUser.name}</span>! Your{' '}
              <span className="font-bold capitalize">{submittedUser.role}</span> account has been sent to the DA Admin for verification.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left flex items-start gap-2">
            <Clock3 className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-relaxed">
              <span className="font-black">Pending Admin Approval.</span> The DA Admin will now check your documents — your Valid
              Government ID
              {submittedUser.role === 'farmer' && submittedUser.rsbsaNumber ? ', RSBSA Number' : ''}
              {submittedUser.role === 'buyer' && submittedUser.businessProofImage ? ' and Small Business Proof' : ''}.
              You can log in ONLY after the admin approves your registration.
            </p>
          </div>

          <p className="text-[10px] text-neutral-500 leading-relaxed">
            Keep your mobile number (<span className="font-mono">{submittedUser.phone}</span>) and password safe — you will use
            them to log in once the admin has approved your account.
          </p>

          <button
            id="btn-submitted-goto-login"
            type="button"
            onClick={() => {
              setSubmittedUser(null);
              setActiveTab('login');
              setRegError(null);
              setLoginError(null);
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <span>Go to Log In</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            id="btn-submitted-register-another"
            type="button"
            onClick={() => setSubmittedUser(null)}
            className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Register another account
          </button>
        </div>
      )}

      {/* Subtle build marker — lets the owner confirm which build is running. */}
      <p className="text-center text-[10px] text-neutral-400 pt-5 pb-1 select-none">
        VeggieConnect · Build {CLIENT_BUILD} (App-Size Verification Review • Valid Government ID Loads on Any Device • DA Verification Queue • RSBSA &amp; Business Proof)
        {serverBuild && serverBuild !== 'unknown' && ` · server ${serverBuild}`}
      </p>
      {mismatch && (
        <div className="mx-auto max-w-md mb-3 rounded-xl border border-red-300 bg-red-50 p-3 text-center text-[10px] font-bold text-red-700">
          VERSION MISMATCH — this page is Build {CLIENT_BUILD} but the RUNNING app server is {serverBuild}.
          Fully stop the app (Ctrl+C in its terminal), start it again from the newest code folder,
          then hard-refresh this page (Ctrl+Shift+R). Until you restart, new features such as the
          Valid Government ID document lookup will NOT work.
        </div>
      )}
    </div>

      {/* REQUIRED LOCATION MAP PICKER
          The account is ONLY created after the user pins their exact location
          on the Google Map (buyer: house / delivery address, farmer: farm
          location). Rendered as a sibling of the login root so `absolute
          inset-0` anchors to the phone shell — it always fits INSIDE the
          app frame, exactly like every other in-app modal. */}
      {showRegMap && (
        <AddressMapPickerModal
          title={selectedRole === 'farmer' ? 'Set Your Farm Location' : 'Set Your Location'}
          subtitle={
            selectedRole === 'farmer'
              ? 'Pin your exact farm location on the map — required to create your account'
              : 'Pin your exact house / delivery address on the map — required to create your account'
          }
          initialAddress={pinnedLocation ? pinnedLocation.address : regLocation}
          initialLat={pinnedLocation ? pinnedLocation.lat : undefined}
          initialLng={pinnedLocation ? pinnedLocation.lng : undefined}
          onClose={() => {
            setShowRegMap(false);
            if (continueSignupAfterPinRef.current) {
              continueSignupAfterPinRef.current = false;
              setRegError('Location is required: pin your exact location on the map, then create your account.');
            }
          }}
          onConfirmLocation={(address, lat, lng) => {
            const pin = { address, lat, lng };
            setPinnedLocation(pin);
            setRegLocation(address);
            setShowRegMap(false);
            if (continueSignupAfterPinRef.current) {
              continueSignupAfterPinRef.current = false;
              setRegError(null);
              createAccount(pin);
            }
          }}
        />
      )}
    </>
  );
};


