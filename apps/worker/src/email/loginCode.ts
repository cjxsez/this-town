/**
 * email/loginCode.ts: sends the 6-digit sign-in code through Cloudflare Email Sending.
 *
 * - Uses the `send_email` binding `EMAIL` (wrangler.toml). The From address must be on a
 *   domain onboarded to Email Sending (`wrangler email sending enable <domain>`).
 * - Under `wrangler dev` the binding is simulated: nothing is sent, and the message (with
 *   the code in the subject) is printed in the worker's log, with the HTML saved to a file.
 *   Set `remote = true` on the binding to send real mail from local dev.
 * - If the binding is missing entirely (it's optional in Env), DEMO_MODE logs the code so
 *   the flow still works; outside DEMO_MODE that is an error.
 * - The look lives in ./template.ts.
 *
 * Throws on failure; routes/auth.ts turns that into a 502 and deletes the unsent code.
 */
import type { Env } from "../env";
import { LOGIN_CODE_TTL_MS, MINUTE } from "../lib/time";
import { loginCodeEmail } from "./template";

const FROM_NAME = "Questline";

export async function sendLoginCode(env: Env, to: string, code: string): Promise<void> {
  const { subject, text, html } = loginCodeEmail(code, Math.round(LOGIN_CODE_TTL_MS / MINUTE));

  if (!env.EMAIL) {
    if (env.DEMO_MODE === "true") {
      console.log(`[questline] no EMAIL binding; sign-in code for ${to}: ${code}`);
      return;
    }
    throw new Error("EMAIL binding is not configured");
  }

  await env.EMAIL.send({
    from: { name: FROM_NAME, email: env.EMAIL_FROM },
    to,
    subject,
    text,
    html,
  });
}
