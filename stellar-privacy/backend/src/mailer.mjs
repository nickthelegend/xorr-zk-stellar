// Pluggable email transport for the "you have a private payment" claim email.
//
// EMAIL_TRANSPORT = console | smtp | resend
//   console (default): logs the email — zero config, works offline for the demo.
//   smtp:              nodemailer over SMTP_URL.
//   resend:            Resend HTTP API with RESEND_API_KEY (https://resend.com).
//
// PRIVACY: the notification never contains the amount, the sender, or any
// secret — only a generic "you've received a private payment, sign in to claim"
// pointing at APP_URL/claim. The recipient's plaintext email is used to send and
// then discarded; it is never persisted.
import nodemailer from "nodemailer";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// Resend's onboarding@resend.dev sender works without domain verification (but
// in test mode only delivers to your own account email). Set EMAIL_FROM to a
// verified-domain sender to email anyone.
function fromAddr() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  return (process.env.EMAIL_TRANSPORT || "").toLowerCase() === "resend"
    ? "XORR <onboarding@resend.dev>"
    : "XORR <no-reply@xorr.local>";
}

export function claimEmail(to, claimUrl) {
  // `claimUrl` is a one-time, signed magic link (…/claim?t=<token>). Opening it
  // claims the payment directly — no sign-in, no seed phrase, no wallet needed.
  // Falls back to the bare /claim page if no token was supplied.
  const link = claimUrl || `${APP_URL.replace(/\/$/, "")}/claim`;
  const subject = "You've received a private payment on XORR";
  const text =
    `Someone sent you a private payment on XORR.\n\n` +
    `Claim it here — no sign-up, no seed phrase, no wallet needed:\n${link}\n\n` +
    `This is your private, one-time claim link — please don't forward it. ` +
    `The amount and sender stay private until you open it. ` +
    `If you weren't expecting this, you can safely ignore this email.`;
  const html =
    `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:auto;padding:8px">` +
    `<div style="font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#7a8">XORR · private payment</div>` +
    `<h2 style="margin:10px 0 12px">You've received a private payment</h2>` +
    `<p style="color:#333;line-height:1.5">Someone sent you a private payment on <b>XORR</b>. ` +
    `Just open your claim link — a private wallet is created for you automatically, ` +
    `no sign-up, no seed phrase, no extension.</p>` +
    `<p style="margin:22px 0"><a href="${link}" style="display:inline-block;background:#a6f24a;color:#000;` +
    `padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:600">Claim your payment →</a></p>` +
    `<p style="color:#888;font-size:13px;line-height:1.5">This is your private, one-time claim link — please don't forward it. ` +
    `The amount and sender stay private until you open it. ` +
    `If you weren't expecting this, you can safely ignore this email.</p></div>`;
  return { to, from: fromAddr(), subject, text, html };
}

function makeTransport() {
  const kind = (process.env.EMAIL_TRANSPORT || "console").toLowerCase();

  if (kind === "smtp") {
    if (!process.env.SMTP_URL) throw new Error("EMAIL_TRANSPORT=smtp but SMTP_URL missing");
    const tx = nodemailer.createTransport(process.env.SMTP_URL);
    return async (msg) => { const r = await tx.sendMail(msg); return { id: r.messageId }; };
  }

  if (kind === "resend") {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("EMAIL_TRANSPORT=resend but RESEND_API_KEY missing");
    return async (msg) => {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: msg.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`resend ${r.status}: ${(body.message || JSON.stringify(body)).slice(0, 160)}`);
      return { id: body.id };
    };
  }

  // console (default)
  return async (msg) => {
    console.log(`\n── EMAIL (console) ─────────────────────────`);
    console.log(`from:    ${msg.from}`);
    console.log(`to:      ${msg.to}`);
    console.log(`subject: ${msg.subject}`);
    console.log(msg.text);
    console.log(`────────────────────────────────────────────\n`);
    return { id: "console" };
  };
}

let _send = null;
export function getMailer() {
  if (!_send) _send = makeTransport();
  return {
    async sendClaim(to, claimUrl) {
      return _send(claimEmail(to, claimUrl));
    },
  };
}
