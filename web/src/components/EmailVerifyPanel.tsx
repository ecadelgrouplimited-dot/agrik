import { useState } from "react";

type Props = {
  email: string;
  title: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<string | undefined>;
  onStatus: (status: { type: "info" | "error"; message: string }) => void;
};

export default function EmailVerifyPanel({ email, title, onVerify, onResend, onStatus }: Props) {
  const [code, setCode] = useState("");

  const parseError = (err: unknown) => {
    if (!err || typeof err !== "object") return "Request failed. Try again.";
    const detail = (err as { detail?: string }).detail;
    return detail || "Request failed. Try again.";
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      onStatus({ type: "error", message: "Enter the 6-digit code you received." });
      return;
    }
    onStatus({ type: "info", message: "Verifying email..." });
    try {
      await onVerify(code.trim());
    } catch (err) {
      onStatus({ type: "error", message: parseError(err) });
    }
  };

  const handleResend = async () => {
    onStatus({ type: "info", message: "Sending a new verification code..." });
    try {
      const message = await onResend();
      onStatus({ type: "info", message: message || "A new verification code has been sent." });
    } catch (err) {
      onStatus({ type: "error", message: parseError(err) });
    }
  };

  return (
    <section className="auth-card auth-card-modern auth-otp-card">
      <div className="auth-panel-head">
        <div>
          <div className="label">{title}</div>
          <h2>Verify email</h2>
          <p>Use the code sent to {email || "your email"}.</p>
        </div>
      </div>
      <div className="auth-form-grid auth-form-grid-login">
        <label className="field auth-span-2">
          Verification code
          <input placeholder="123456" value={code} onChange={(event) => setCode(event.target.value)} />
        </label>
      </div>
      <div className="auth-actions auth-actions-stacked">
        <button className="btn" onClick={handleVerify}>
          Verify email
        </button>
        <button className="btn ghost" onClick={handleResend}>
          Resend code
        </button>
      </div>
    </section>
  );
}
