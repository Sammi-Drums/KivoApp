"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconCircleCheck,
} from "@tabler/icons-react";

const C = {
  bg: "#0D1829",
  surface: "#152133",
  border: "rgba(255,255,255,0.08)",
  text: "#EDF2FF",
  textMuted: "#8896AE",
  textFaint: "#3E5170",
  primary: "#00D46A",
  danger: "#FF4757",
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [status, setStatus] = useState("verifying"); // verifying | ready | invalid
  const [pFocus, setPFocus] = useState(false);
  const [cFocus, setCFocus] = useState(false);

  useEffect(() => {
    async function handleRecovery() {
      try {
        // The reset link can arrive in two formats. Handle both.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = window.location.hash;

        // Format 1: PKCE code flow (?code=...)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus("invalid");
            return;
          }
          setStatus("ready");
          // Clean the URL so refreshing doesn't re-trigger
          window.history.replaceState({}, "", "/reset-password");
          return;
        }

        // Format 2: Hash token flow (#access_token=...&type=recovery)
        if (hash && hash.includes("access_token")) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) {
              setStatus("invalid");
              return;
            }
            setStatus("ready");
            window.history.replaceState({}, "", "/reset-password");
            return;
          }
        }

        // Format 3: session already exists (recovery event fired)
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setStatus("ready");
          return;
        }

        // Nothing valid found
        setStatus("invalid");
      } catch (err) {
        setStatus("invalid");
      }
    }

    // Also listen for the PASSWORD_RECOVERY event as a backup
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    handleRecovery();
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    // Sign out so they log in fresh with the new password
    setTimeout(async () => {
      await supabase.auth.signOut();
      router.push("/login");
    }, 2500);
  };

  const inputStyle = (focused) => ({
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: C.bg,
    border: `1px solid ${focused ? C.primary : "rgba(255,255,255,0.12)"}`,
    borderRadius: 10,
    padding: "13px 14px",
    color: C.text,
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.15s",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        backgroundColor: C.bg,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          background:
            "radial-gradient(circle, rgba(0,212,106,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 400,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: C.primary,
              color: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 16,
              boxShadow: "0 8px 24px rgba(0,212,106,0.3)",
            }}
          >
            KR
          </div>
          <span style={{ fontSize: 26, fontWeight: 800, color: C.text }}>
            Kivo <span style={{ color: C.primary }}>Rides</span>
          </span>
        </div>
        <p
          style={{
            textAlign: "center",
            color: C.textMuted,
            fontSize: 14,
            margin: "0 0 32px 0",
          }}
        >
          Set a new password
        </p>

        <div
          style={{
            backgroundColor: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: 32,
            boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          }}
        >
          {success ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <IconCircleCheck
                size={56}
                color={C.primary}
                style={{ marginBottom: 16 }}
              />
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: C.text,
                  margin: "0 0 8px 0",
                }}
              >
                Password updated!
              </h1>
              <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>
                Redirecting you to sign in…
              </p>
            </div>
          ) : status === "verifying" ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <IconLoader2
                size={40}
                color={C.primary}
                style={{
                  animation: "kivospin 0.8s linear infinite",
                  marginBottom: 16,
                }}
              />
              <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>
                Verifying your reset link…
              </p>
            </div>
          ) : status === "invalid" ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: C.text,
                  margin: "0 0 8px 0",
                }}
              >
                Link expired or invalid
              </h1>
              <p
                style={{
                  color: C.textMuted,
                  fontSize: 14,
                  margin: "0 0 20px 0",
                }}
              >
                Reset links expire after a short time. Request a fresh one from
                the sign-in page.
              </p>
              <button
                onClick={() => router.push("/login")}
                style={{
                  width: "100%",
                  backgroundColor: C.primary,
                  color: "#000",
                  border: "none",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  margin: "0 0 4px 0",
                  color: C.text,
                }}
              >
                New password
              </h1>
              <p
                style={{
                  color: C.textMuted,
                  fontSize: 14,
                  margin: "0 0 24px 0",
                }}
              >
                Choose a strong password you'll remember
              </p>

              {error && (
                <div
                  style={{
                    backgroundColor: "rgba(255,71,87,0.12)",
                    border: "1px solid rgba(255,71,87,0.25)",
                    color: C.danger,
                    fontSize: 13,
                    padding: "12px 14px",
                    borderRadius: 10,
                    marginBottom: 20,
                  }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleReset}>
                <div style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      color: C.textMuted,
                      marginBottom: 8,
                    }}
                  >
                    NEW PASSWORD
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      style={{ ...inputStyle(pFocus), paddingRight: 48 }}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPFocus(true)}
                      onBlur={() => setPFocus(false)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: C.textMuted,
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showPassword ? (
                        <IconEyeOff size={20} />
                      ) : (
                        <IconEye size={20} />
                      )}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      color: C.textMuted,
                      marginBottom: 8,
                    }}
                  >
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    style={inputStyle(cFocus)}
                    placeholder="Type it again"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onFocus={() => setCFocus(true)}
                    onBlur={() => setCFocus(false)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: C.primary,
                    color: "#000",
                    border: "none",
                    borderRadius: 10,
                    padding: 14,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    marginTop: 6,
                  }}
                >
                  {loading ? (
                    <>
                      <IconLoader2
                        size={18}
                        style={{ animation: "kivospin 0.8s linear infinite" }}
                      />
                      Updating…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            color: C.textFaint,
            fontSize: 12,
            marginTop: 24,
          }}
        >
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
