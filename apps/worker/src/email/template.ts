/**
 * email/template.ts: the sign-in email, styled after phone-web (styles/tokens.css + ui.css):
 * sea-teal page, paper card with an ink outline and a hard offset shadow, the QUESTLINE
 * wordmark in Bungee Shade, the code as yellow keycaps like the app's primary button, and
 * Gaegu for body text.
 *
 * Email-client constraints: tables + inline styles only, no SVG filters (so no wobble), no
 * images (nothing to host yet). Fonts load from Google Fonts where the client allows it
 * (Apple Mail, iOS Mail); Gmail and Outlook fall back to Arial Black / system fonts, and the
 * layout still holds. Colors are the light "Day" theme tokens.
 */

const C = {
  sea: "#62c1bc",
  foam: "#9ae4d6",
  ink: "#26343b",
  inkSoft: "#48606d",
  shadow: "#557585",
  paper: "#f4f5ec",
  paperLo: "#d5d9c7",
  yellow: "#f2c84b",
  yellowDk: "#c9982e",
} as const;

const DISPLAY = `'Bungee', 'Arial Black', Arial, sans-serif`;
const SHADE = `'Bungee Shade', 'Bungee', 'Arial Black', Arial, sans-serif`;
const HAND = `'Gaegu', 'Comic Sans MS', 'Trebuchet MS', sans-serif`;

export interface LoginEmail {
  subject: string;
  text: string;
  html: string;
}

export function loginCodeEmail(code: string, ttlMinutes: number): LoginEmail {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const subject = `${spaced} is your Questline code`;
  const text = [
    "QUESTLINE",
    "",
    `Your sign-in code: ${spaced}`,
    "",
    `Type it into Questline on your phone. It works for ${ttlMinutes} minutes and only once.`,
    "",
    "Didn't ask for this? Ignore it. Nobody gets in without the code.",
    "",
    "Short games with one other rider. Spoken, face to face, done before your stop.",
  ].join("\n");

  // Each digit is a keycap: yellow, ink outline, darker bottom edge (inset shadow in clients
  // that support it, a thick bottom border everywhere else), like .q-btn.
  const keycap = (d: string, tilt: number) => `
          <td style="padding:0 3px">
            <div style="width:38px;height:52px;line-height:52px;text-align:center;background:${C.yellow};color:${C.ink};border:2px solid ${C.ink};border-bottom:6px solid ${C.ink};border-radius:7px 4px 8px 5px;box-shadow:inset 0 -4px 0 ${C.yellowDk},2px 3px 0 ${C.shadow};font:400 30px/52px ${DISPLAY};transform:rotate(${tilt}deg)">${d}</div>
          </td>`;
  const tilts = [-2, 1.5, -1, 2, -1.5, 1];
  const digits = code.split("");
  const caps = (from: number) =>
    digits
      .slice(from, from + 3)
      .map((d, i) => keycap(d, tilts[from + i] ?? 0))
      .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${subject}</title>
<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Bungee+Shade&family=Gaegu:wght@400;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.sea};-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.sea}">Your code is ${spaced}. It works for ${ttlMinutes} minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.sea}">
    <tr>
      <td align="center" style="padding:36px 16px 40px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px">
          <tr>
            <td align="center" style="padding:0 0 22px;font:400 40px/1 ${SHADE};letter-spacing:1px;color:${C.ink}">QUESTLINE</td>
          </tr>
          <tr>
            <td style="background:${C.paper};border:2px solid ${C.ink};border-radius:5px 8px 4px 7px;box-shadow:3px 5px 0 ${C.shadow};padding:24px 22px 26px">
              <p style="margin:0 0 4px;font:400 12px/1.2 ${DISPLAY};letter-spacing:1.5px;text-transform:uppercase;color:${C.inkSoft}">Sign in</p>
              <p style="margin:0 0 20px;font:700 26px/1.15 ${HAND};color:${C.ink}">Here's your code</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto">
                <tr>${caps(0)}
                  <td style="width:14px"></td>${caps(3)}
                </tr>
              </table>
              <p style="margin:22px 0 0;font:400 19px/1.3 ${HAND};color:${C.ink}">Type it into Questline on your phone. It works for ${ttlMinutes} minutes, and only once.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px">
                <tr>
                  <td style="background:${C.paperLo};border:2px solid ${C.ink};border-radius:8px 5px 7px 4px;padding:10px 14px;font:400 16px/1.3 ${HAND};color:${C.inkSoft}">
                    Didn't ask for this? Ignore it. Nobody gets in without the code.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 12px 0;font:400 18px/1.3 ${HAND};color:${C.ink}">
              Short games with one other rider.<br>Spoken, face to face, done before your stop.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
