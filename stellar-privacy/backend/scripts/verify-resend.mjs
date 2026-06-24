// Live test: send the XORR claim email via Resend.
// Run: RESEND_API_KEY=… TEST_TO=you@example.com EMAIL_TRANSPORT=resend \
//      node scripts/verify-resend.mjs
// (EMAIL_FROM optional — defaults to onboarding@resend.dev, which in Resend test
//  mode only delivers to your own account email; set a verified-domain sender to
//  email anyone.)
import { getMailer, claimEmail } from "../src/mailer.mjs";

const TO = process.env.TEST_TO;
if (!process.env.RESEND_API_KEY) { console.error("set RESEND_API_KEY"); process.exit(1); }
if (!TO) { console.error("set TEST_TO=<recipient email>"); process.exit(1); }
process.env.EMAIL_TRANSPORT = process.env.EMAIL_TRANSPORT || "resend";

const preview = claimEmail(TO);
console.log(`sending claim email via ${process.env.EMAIL_TRANSPORT}`);
console.log(`  from:    ${preview.from}`);
console.log(`  to:      ${TO}`);
console.log(`  subject: ${preview.subject}`);

const res = await getMailer().sendClaim(TO);
console.log(`\n✅ sent — message id: ${res.id}`);
console.log("   check the inbox for the 'Sign in to claim' button → /claim");
