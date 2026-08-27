import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/auth";
import EmailVerifyPanel from "../components/EmailVerifyPanel";

type StatusMessage = { type: "info" | "error"; message: string };

export default function LoginPage() {
  const { login, verify, resendVerificationCode, requestPasswordReset, resetPassword } = useAuth();

  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordCode, setForgotPasswordCode] = useState("");
  const [forgotPasswordNewPassword, setForgotPasswordNewPassword] = useState("");
  const [forgotPasswordCodeSent, setForgotPasswordCodeSent] = useState(false);

  const [status, setStatus] = useState<StatusMessage | null>(null);

  const parseError = (err: unknown) => {
    if (!err || typeof err !== "object") return "Request failed. Try again.";
    const detail = (err as { detail?: string }).detail;
    return detail || "Request failed. Try again.";
  };

  const handleLogin = async () => {
    if (!loginPhone.trim()) {
      setStatus({ type: "error", message: "Enter your phone number." });
      return;
    }
    setStatus({ type: "info", message: "Signing in..." });
    try {
      const result = await login(loginPhone.trim(), loginPassword.trim() || undefined);
      if (result.status === "logged_in") {
        setOtpRequired(false);
        setStatus({ type: "info", message: "Signed in." });
        return;
      }
      setOtpRequired(true);
      setVerificationEmail(result.user?.email || "");
      setStatus({ type: "info", message: result.message || "Verify your email before signing in." });
    } catch (err) {
      setStatus({ type: "error", message: parseError(err) });
    }
  };

  const handleForgotPasswordRequest = async () => {
    if (!forgotPasswordEmail.trim()) {
      setStatus({ type: "error", message: "Enter your email address to reset your password." });
      return;
    }
    setStatus({ type: "info", message: "Sending reset code..." });
    try {
      const result = await requestPasswordReset(forgotPasswordEmail.trim());
      setForgotPasswordCodeSent(true);
      setStatus({ type: "info", message: result.message || "If the email exists, a reset code has been sent." });
    } catch (err) {
      setStatus({ type: "error", message: parseError(err) });
    }
  };

  const handleForgotPasswordReset = async () => {
    if (!forgotPasswordCode.trim()) {
      setStatus({ type: "error", message: "Enter the reset code from your email." });
      return;
    }
    if (forgotPasswordNewPassword.trim().length < 6) {
      setStatus({ type: "error", message: "Use a new password with at least 6 characters." });
      return;
    }
    setStatus({ type: "info", message: "Resetting password..." });
    try {
      await resetPassword(forgotPasswordEmail.trim(), forgotPasswordCode.trim(), forgotPasswordNewPassword);
      setForgotPasswordOpen(false);
      setForgotPasswordCodeSent(false);
      setForgotPasswordCode("");
      setForgotPasswordNewPassword("");
      setStatus({ type: "info", message: "Password reset complete. You are now signed in." });
    } catch (err) {
      setStatus({ type: "error", message: parseError(err) });
    }
  };

  return (
    <div className="auth-page auth-page-modern">
      <div className="auth-page-solo">
        <section className="auth-card auth-card-modern">
          <div className="auth-panel-head">
            <div>
              <div className="label">Sign in</div>
              <h2>Access your AGRIK account</h2>
              <p>Use your phone number and password. Unverified accounts must confirm email first.</p>
            </div>
          </div>

          <div className="auth-form-grid auth-form-grid-login">
            <label className="field auth-span-2">
              Phone number
              <input placeholder="+2567..." value={loginPhone} onChange={(event) => setLoginPhone(event.target.value)} />
            </label>
            <label className="field auth-span-2">
              Password
              <input
                type="password"
                placeholder="Your password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>
          </div>

          <div className="auth-actions auth-actions-stacked">
            <button className="btn" onClick={handleLogin}>
              Sign in
            </button>
            <button className="btn ghost" onClick={() => setForgotPasswordOpen((current) => !current)}>
              {forgotPasswordOpen ? "Close password reset" : "Forgot password?"}
            </button>
          </div>

          <article className="auth-insight-card compact">
            <div className="label">New here?</div>
            <p>
              <Link to="/auth/register">Create a separate account</Link> with your role, district, parish, and crop or
              service profile.
            </p>
          </article>
        </section>

        {otpRequired ? (
          <EmailVerifyPanel
            email={verificationEmail}
            title="Sign in verification"
            onStatus={setStatus}
            onVerify={async (code) => {
              await verify(verificationEmail.trim(), code);
              setOtpRequired(false);
              setStatus({ type: "info", message: "Email verified. You are now signed in." });
            }}
            onResend={async () => {
              const result = await resendVerificationCode(verificationEmail.trim());
              return result.message;
            }}
          />
        ) : null}

        {forgotPasswordOpen ? (
          <section className="auth-card auth-card-modern auth-otp-card">
            <div className="auth-panel-head">
              <div>
                <div className="label">Password recovery</div>
                <h2>Reset your password</h2>
                <p>Use your account email to receive a 6-digit reset code.</p>
              </div>
            </div>
            <div className="auth-form-grid auth-form-grid-login">
              <label className="field auth-span-2">
                Email address
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={forgotPasswordEmail}
                  onChange={(event) => setForgotPasswordEmail(event.target.value)}
                />
              </label>
              {forgotPasswordCodeSent ? (
                <>
                  <label className="field auth-span-2">
                    Reset code
                    <input
                      placeholder="123456"
                      value={forgotPasswordCode}
                      onChange={(event) => setForgotPasswordCode(event.target.value)}
                    />
                  </label>
                  <label className="field auth-span-2">
                    New password
                    <input
                      type="password"
                      placeholder="At least 6 characters"
                      value={forgotPasswordNewPassword}
                      onChange={(event) => setForgotPasswordNewPassword(event.target.value)}
                    />
                  </label>
                </>
              ) : null}
            </div>
            <div className="auth-actions auth-actions-stacked">
              <button className="btn" onClick={handleForgotPasswordRequest}>
                {forgotPasswordCodeSent ? "Send another reset code" : "Send reset code"}
              </button>
              {forgotPasswordCodeSent ? (
                <button className="btn ghost" onClick={handleForgotPasswordReset}>
                  Reset password
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {status ? <p className={`status ${status.type === "error" ? "error" : ""}`}>{status.message}</p> : null}
      </div>
    </div>
  );
}
