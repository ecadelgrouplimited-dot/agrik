import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.secure,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

async function send(to: string, subject: string, html: string, text: string) {
  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    html,
    text,
  });
}

function wrapper(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5ef;font-family:Manrope,Segoe UI,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#11442d;padding:24px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.02em;">AGRIK</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:18px;color:#0b0b0b;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px;color:#767a70;font-size:12px;">
                AGRIK &mdash; digital extension intelligence for farmers.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationEmail(to: string, code: string) {
  const html = wrapper(
    "Verify your email",
    `<p style="color:#333;font-size:14px;line-height:1.6;">Use this code to verify your AGRIK account. It expires in 15 minutes.</p>
     <p style="font-size:32px;font-weight:800;letter-spacing:0.1em;color:#11442d;margin:24px 0;">${code}</p>
     <p style="color:#767a70;font-size:13px;">If you didn't request this, you can ignore this email.</p>`
  );
  await send(to, "Verify your AGRIK account", html, `Your AGRIK verification code is ${code}. It expires in 15 minutes.`);
}

export async function sendPasswordResetEmail(to: string, code: string) {
  const html = wrapper(
    "Reset your password",
    `<p style="color:#333;font-size:14px;line-height:1.6;">Use this code to reset your AGRIK password. It expires in 15 minutes.</p>
     <p style="font-size:32px;font-weight:800;letter-spacing:0.1em;color:#11442d;margin:24px 0;">${code}</p>
     <p style="color:#767a70;font-size:13px;">If you didn't request this, you can ignore this email and your password will stay the same.</p>`
  );
  await send(to, "Reset your AGRIK password", html, `Your AGRIK password reset code is ${code}. It expires in 15 minutes.`);
}

export async function sendAdminOtpEmail(to: string, code: string) {
  const html = wrapper(
    "Admin sign-in code",
    `<p style="color:#333;font-size:14px;line-height:1.6;">Use this code to finish signing in to the AGRIK admin console. It expires in 10 minutes.</p>
     <p style="font-size:32px;font-weight:800;letter-spacing:0.1em;color:#11442d;margin:24px 0;">${code}</p>
     <p style="color:#767a70;font-size:13px;">If you didn't request this, rotate the admin password immediately.</p>`
  );
  await send(to, "Your AGRIK admin sign-in code", html, `Your AGRIK admin sign-in code is ${code}. It expires in 10 minutes.`);
}

export async function sendWelcomeEmail(to: string, fullName: string) {
  const html = wrapper(
    `Welcome, ${fullName || "there"}`,
    `<p style="color:#333;font-size:14px;line-height:1.6;">Your AGRIK account is verified and ready. Start with advisory, check the marketplace, or set up your farm profile.</p>`
  );
  await send(to, "Welcome to AGRIK", html, `Welcome to AGRIK, ${fullName || "there"}. Your account is verified and ready.`);
}
