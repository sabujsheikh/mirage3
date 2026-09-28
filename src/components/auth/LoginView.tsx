import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Moon,
  Sun,
  AlertCircle,
  X,
} from 'lucide-react';

import mirageLeftPanelImg from '../../assets/images/mirage_left_panel_1788860186511.jpg';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedMinutes, setLockedMinutes] = useState<number | null>(null);

  const [showForgotModal, setShowForgotModal] = useState(false);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      setErrorMessage('Please enter your username/email and password.');
      setLockedMinutes(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setLockedMinutes(null);

    try {
      const result = await login(cleanIdentifier, cleanPassword);

      if (!result.success) {
        if (result.locked) {
          setLockedMinutes(result.remainingMinutes || 15);
        }

        setErrorMessage(
          result.error || 'Authentication failed. Please check your credentials.'
        );
      }
    } catch {
      setErrorMessage('Unable to sign in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <div
      className={[
        'min-h-screen w-full flex items-center justify-center',
        'px-4 py-5 sm:px-6 lg:px-8',
        'font-sans antialiased',
        'transition-colors duration-300',
        isDark ? 'bg-[#0B0E13]' : 'bg-[#EAE7E2]',
      ].join(' ')}
    >
      <div
        className={[
          'w-full max-w-[1380px]',
          'min-h-[720px] lg:h-[calc(100vh-40px)]',
          'max-h-[900px]',
          'overflow-hidden',
          'flex flex-col lg:flex-row',
          'rounded-[20px]',
          'border',
          'shadow-[0_24px_70px_rgba(0,0,0,0.16)]',
          isDark
            ? 'border-white/10 bg-[#141820] shadow-black/50'
            : 'border-black/[0.08] bg-white',
        ].join(' ')}
      >
        {/* -------------------------------------------------
            LEFT BRAND PANEL
           ------------------------------------------------- */}
        <section
          className={[
            'relative w-full lg:w-[47%]',
            'min-h-[260px] lg:min-h-0',
            'overflow-hidden',
            'flex items-center',
            isDark ? 'bg-[#0E1117]' : 'bg-[#17130F]',
          ].join(' ')}
        >
          {/* Luxurious Mirage Perfumes Left Panel Artwork */}
          <img
            src={mirageLeftPanelImg}
            alt="Mirage Perfumes"
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
          />
        </section>

        {/* -------------------------------------------------
            RIGHT LOGIN PANEL
           ------------------------------------------------- */}
        <section
          className={[
            'relative flex-1',
            'flex flex-col',
            'px-7 py-8 sm:px-10 sm:py-10 lg:px-14 xl:px-20',
            isDark ? 'bg-[#151A21]' : 'bg-white',
          ].join(' ')}
        >
          {/* Theme control */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleTheme}
              className={[
                'inline-flex items-center gap-2',
                'rounded-full px-3 py-2',
                'text-[12px] font-medium',
                'transition-colors cursor-pointer',
                isDark
                  ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
              ].join(' ')}
              title="Switch theme"
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4" strokeWidth={1.8} />
                  <span>Light mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" strokeWidth={1.8} />
                  <span>Dark mode</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-[430px] py-8">
              {/* Header */}
              <div className="mb-9">
                <h1
                  className={[
                    'text-[34px] sm:text-[40px]',
                    'font-semibold tracking-[-0.03em]',
                    isDark ? 'text-white' : 'text-[#162C46]',
                  ].join(' ')}
                >
                  Welcome back
                </h1>

                <p
                  className={[
                    'mt-2 text-[14px] sm:text-[15px]',
                    isDark ? 'text-slate-400' : 'text-slate-500',
                  ].join(' ')}
                >
                  Sign in to Mirage Perfumes
                </p>
              </div>

              {/* Error */}
              {errorMessage && (
                <div
                  className={[
                    'mb-6 flex items-start gap-3 rounded-xl border px-4 py-3.5',
                    'text-[13px] leading-5',
                    lockedMinutes
                      ? isDark
                        ? 'border-rose-900/70 bg-rose-950/30 text-rose-300'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                      : isDark
                        ? 'border-amber-900/60 bg-amber-950/20 text-amber-300'
                        : 'border-amber-200 bg-amber-50 text-amber-800',
                  ].join(' ')}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                  <div>
                    <div className="font-semibold">
                      {lockedMinutes
                        ? 'Account temporarily locked.'
                        : 'Sign in failed.'}
                    </div>

                    <div className="mt-0.5 opacity-90">
                      {errorMessage}
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Username */}
                <div>
                  <label
                    className={[
                      'mb-2 block text-[13px] font-semibold',
                      isDark ? 'text-slate-200' : 'text-slate-800',
                    ].join(' ')}
                  >
                    Username, email or mobile
                  </label>

                  <div className="relative">
                    <User
                      className={[
                        'absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2',
                        isDark ? 'text-slate-500' : 'text-slate-400',
                      ].join(' ')}
                      strokeWidth={1.8}
                    />

                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                        if (lockedMinutes) setLockedMinutes(null);
                      }}
                      placeholder="Enter your username, email or mobile"
                      autoComplete="username"
                      required
                      className={[
                        'h-[52px] w-full rounded-[10px]',
                        'border bg-transparent',
                        'pl-11 pr-4',
                        'text-[14px]',
                        'outline-none transition-all',
                        isDark
                          ? 'border-slate-700 bg-slate-950/30 text-white placeholder:text-slate-600 focus:border-slate-500'
                          : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-400',
                      ].join(' ')}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    className={[
                      'mb-2 block text-[13px] font-semibold',
                      isDark ? 'text-slate-200' : 'text-slate-800',
                    ].join(' ')}
                  >
                    Password
                  </label>

                  <div className="relative">
                    <Lock
                      className={[
                        'absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2',
                        isDark ? 'text-slate-500' : 'text-slate-400',
                      ].join(' ')}
                      strokeWidth={1.8}
                    />

                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                        if (lockedMinutes) setLockedMinutes(null);
                      }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      className={[
                        'h-[52px] w-full rounded-[10px]',
                        'border bg-transparent',
                        'pl-11 pr-12',
                        'text-[14px]',
                        'outline-none transition-all',
                        isDark
                          ? 'border-slate-700 bg-slate-950/30 text-white placeholder:text-slate-600 focus:border-slate-500'
                          : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-400',
                      ].join(' ')}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className={[
                        'absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5',
                        'transition-colors cursor-pointer',
                        isDark
                          ? 'text-slate-500 hover:text-slate-300'
                          : 'text-slate-400 hover:text-slate-700',
                      ].join(' ')}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} />
                      ) : (
                        <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Options */}
                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={keepSignedIn}
                      onChange={(e) => setKeepSignedIn(e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-[#162C46]"
                    />

                    <span
                      className={[
                        'text-[13px]',
                        isDark ? 'text-slate-400' : 'text-slate-600',
                      ].join(' ')}
                    >
                      Keep me signed in
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className={[
                      'text-[13px] font-medium transition-colors cursor-pointer',
                      isDark
                        ? 'text-slate-300 hover:text-white'
                        : 'text-[#173553] hover:text-[#0D2238]',
                    ].join(' ')}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign in */}
                <button
                  type="submit"
                  disabled={loading}
                  className={[
                    'mt-2 flex h-[52px] w-full items-center justify-center gap-2.5',
                    'rounded-[10px]',
                    'text-[14px] font-semibold text-white',
                    'transition-all cursor-pointer',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    isDark
                      ? 'bg-[#24405F] hover:bg-[#2B4D72]'
                      : 'bg-[#162C46] hover:bg-[#0F2135]',
                  ].join(' ')}
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Footer */}
          <div
            className={[
              'border-t pt-5 text-center',
              isDark ? 'border-white/[0.06]' : 'border-slate-100',
            ].join(' ')}
          >
            <p
              className={[
                'text-[11px]',
                isDark ? 'text-slate-500' : 'text-slate-400',
              ].join(' ')}
            >
              © 2026 Mirage Perfumes &nbsp;·&nbsp; Internal Use Only
            </p>
          </div>
        </section>
      </div>

      {/* -------------------------------------------------
          FORGOT PASSWORD
         ------------------------------------------------- */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
          <div
            className={[
              'relative w-full max-w-[380px] rounded-2xl border p-6 shadow-2xl',
              isDark
                ? 'border-slate-700 bg-[#171C24] text-white'
                : 'border-slate-200 bg-white text-slate-900',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className={[
                'absolute right-4 top-4 rounded-md p-1.5 cursor-pointer',
                isDark
                  ? 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
              ].join(' ')}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="pr-8 text-[17px] font-semibold">
              Password reset
            </h3>

            <p
              className={[
                'mt-2 text-[13px] leading-6',
                isDark ? 'text-slate-400' : 'text-slate-500',
              ].join(' ')}
            >
              Password resets are handled by the authorized system
              administrator for this internal ERP.
            </p>

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className={[
                'mt-5 h-11 w-full rounded-lg text-[13px] font-semibold text-white cursor-pointer',
                isDark
                  ? 'bg-[#24405F] hover:bg-[#2B4D72]'
                  : 'bg-[#162C46] hover:bg-[#0F2135]',
              ].join(' ')}
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
