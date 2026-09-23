import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../state/adminAuth";

const CODE_TTL_SECONDS = 10 * 60;

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, verify, error } = useAdminAuth();

  // Signing in takes two steps: the password gets a code emailed to the admin address,
  // and the code exchanges for a session. The console previously stopped after step one
  // and sent you to /admin, which bounced straight back here.
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "code") return;
    codeInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const result = await login(email.trim(), password);
      if (result === "logged_in") {
        navigate("/admin");
        return;
      }
      setStep("code");
      setCode("");
      setSecondsLeft(CODE_TTL_SECONDS);
      setNotice(`We emailed a 6-digit code to ${email.trim()}.`);
    } catch {
      // useAdminAuth already holds the message to show.
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      await verify(email.trim(), code.trim());
      navigate("/admin");
    } catch {
      // useAdminAuth already holds the message to show.
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStep("credentials");
    setCode("");
    setPassword("");
    setNotice(null);
    setSecondsLeft(0);
  };

  const expiry =
    secondsLeft > 0
      ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
      : "This code has expired — send a new one.";

  return (
    <div className="admin-auth-page">
      <div className="admin-auth-card">
        <div className="label">Admin access</div>
        <h2>{step === "credentials" ? "Secure console" : "Check your email"}</h2>
        <p className="muted">
          {step === "credentials"
            ? "Sign in with your admin email and password. We then email a one-time code to confirm it is you."
            : `Enter the 6-digit code sent to ${email.trim()}.`}
        </p>

        {step === "credentials" ? (
          <form className="admin-auth-form" onSubmit={requestCode}>
            <label className="field">
              Admin email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@company.com"
                autoComplete="username"
                required
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Sending code..." : "Continue"}
            </button>
          </form>
        ) : (
          <form className="admin-auth-form" onSubmit={submitCode}>
            <label className="field">
              One-time code
              <input
                ref={codeInputRef}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="admin-auth-code"
                required
              />
            </label>
            <p className="admin-auth-expiry">{expiry}</p>
            <button className="btn" type="submit" disabled={loading || code.length < 4}>
              {loading ? "Verifying..." : "Sign in"}
            </button>
            <div className="admin-auth-links">
              <button type="button" className="link-button" onClick={() => requestCode()} disabled={loading}>
                Send a new code
              </button>
              <button type="button" className="link-button" onClick={startOver} disabled={loading}>
                Use a different account
              </button>
            </div>
          </form>
        )}

        {(notice || error) && <p className={`status ${error ? "error" : ""}`}>{error ?? notice}</p>}
      </div>
    </div>
  );
}
