'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { IconEye, IconEyeOff, IconLoader2 } from '@tabler/icons-react';

const C = {
  bg: '#0D1829', surface: '#152133', border: 'rgba(255,255,255,0.08)',
  text: '#EDF2FF', textMuted: '#8896AE', textFaint: '#3E5170',
  primary: '#00D46A', danger: '#FF4757',
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus, setPassFocus] = useState(false);

  // Forgot-password state
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (authError) {
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from('admins')
        .select('id, full_name, position')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (adminError || !admin) {
        await supabase.auth.signOut();
        setError('This account does not have admin access.');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setResetLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
  };

  const inputStyle = (focused) => ({
    width: '100%', boxSizing: 'border-box', backgroundColor: C.bg,
    border: `1px solid ${focused ? C.primary : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 10, padding: '13px 14px', color: C.text, fontSize: 15,
    outline: 'none', transition: 'border-color 0.15s',
  });

  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24, boxSizing: 'border-box',
      backgroundColor: C.bg, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(0,212,106,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, backgroundColor: C.primary, color: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, boxShadow: '0 8px 24px rgba(0,212,106,0.3)',
          }}>KR</div>
          <span style={{ fontSize: 26, fontWeight: 800, color: C.text }}>
            Kivo <span style={{ color: C.primary }}>Rides</span>
          </span>
        </div>
        <p style={{ textAlign: 'center', color: C.textMuted, fontSize: 14, margin: '0 0 32px 0' }}>
          Admin Dashboard
        </p>

        <div style={{
          backgroundColor: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: 32, boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}>
          {forgotMode ? (
            resetSent ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 8px 0' }}>
                  Check your email
                </h1>
                <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 20px 0' }}>
                  We sent a password reset link to <strong style={{ color: C.text }}>{email}</strong>. Click it to set a new password.
                </p>
                <button onClick={() => { setForgotMode(false); setResetSent(false); }}
                  style={{
                    width: '100%', backgroundColor: 'transparent', border: `1px solid rgba(255,255,255,0.12)`,
                    color: C.text, borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px 0', color: C.text }}>
                  Reset password
                </h1>
                <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 24px 0' }}>
                  Enter your email and we'll send a reset link
                </p>

                {error && (
                  <div style={{
                    backgroundColor: 'rgba(255,71,87,0.12)', border: '1px solid rgba(255,71,87,0.25)',
                    color: C.danger, fontSize: 13, padding: '12px 14px', borderRadius: 10, marginBottom: 20,
                  }}>{error}</div>
                )}

                <form onSubmit={handleForgot}>
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.textMuted, marginBottom: 8 }}>
                      EMAIL
                    </label>
                    <input type="email" style={inputStyle(emailFocus)} placeholder="you@example.com"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)} required />
                  </div>

                  <button type="submit" disabled={resetLoading}
                    style={{
                      width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 8, backgroundColor: C.primary, color: '#000',
                      border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700,
                      cursor: resetLoading ? 'not-allowed' : 'pointer', opacity: resetLoading ? 0.7 : 1,
                    }}>
                    {resetLoading ? (
                      <><IconLoader2 size={18} style={{ animation: 'kivospin 0.8s linear infinite' }} />Sending…</>
                    ) : 'Send Reset Link'}
                  </button>
                </form>

                <button onClick={() => { setForgotMode(false); setError(''); }}
                  style={{
                    width: '100%', background: 'none', border: 'none', color: C.textMuted,
                    fontSize: 13, cursor: 'pointer', marginTop: 16,
                  }}>
                  ← Back to sign in
                </button>
              </>
            )
          ) : (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px 0', color: C.text }}>
                Welcome back
              </h1>
              <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 24px 0' }}>
                Sign in to manage the platform
              </p>

              {error && (
                <div style={{
                  backgroundColor: 'rgba(255,71,87,0.12)', border: '1px solid rgba(255,71,87,0.25)',
                  color: C.danger, fontSize: 13, padding: '12px 14px', borderRadius: 10, marginBottom: 20,
                }}>{error}</div>
              )}

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.textMuted, marginBottom: 8 }}>
                    EMAIL
                  </label>
                  <input type="email" style={inputStyle(emailFocus)} placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
                    autoComplete="email" required />
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.textMuted, marginBottom: 8 }}>
                    PASSWORD
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPassword ? 'text' : 'password'}
                      style={{ ...inputStyle(passFocus), paddingRight: 48 }}
                      placeholder="Enter your password" value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPassFocus(true)} onBlur={() => setPassFocus(false)}
                      autoComplete="current-password" required />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer',
                        padding: 4, display: 'flex', alignItems: 'center',
                      }}>
                      {showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />}
                    </button>
                  </div>
                </div>

                <div style={{ textAlign: 'right', marginBottom: 20 }}>
                  <button type="button" onClick={() => { setForgotMode(true); setError(''); }}
                    style={{ background: 'none', border: 'none', color: C.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={loading}
                  style={{
                    width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8, backgroundColor: C.primary, color: '#000',
                    border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                  }}>
                  {loading ? (
                    <><IconLoader2 size={18} style={{ animation: 'kivospin 0.8s linear infinite' }} />Signing in…</>
                  ) : 'Sign In'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', color: C.textFaint, fontSize: 12, marginTop: 24 }}>
          Kivo Rides · Bamenda, Cameroon
        </p>
      </div>

      <style>{`
        @keyframes kivospin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        body { margin: 0; }
      `}</style>
    </div>
  );
}
