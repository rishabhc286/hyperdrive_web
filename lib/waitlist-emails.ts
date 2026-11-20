import { CLOUD_PROVIDERS, type CloudProviderId } from "@/lib/waitlist";

/**
 * Waitlist email content: pure functions that return subject / text / HTML.
 * Sending lives in `lib/mailer.ts`. HTML uses tables + inline styles so it
 * renders the same in Gmail, Outlook and Apple Mail.
 */

export interface SignupDetails {
  email: string;
  providers: CloudProviderId[];
  position: number;
  /** Waitlist size right after this signup, if known. */
  total?: number;
  /** ISO timestamp of the signup. */
  joinedAt: string;
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "Consolas,'SFMono-Regular',Menlo,monospace";
const C = {
  page: "#f4f5f7",
  card: "#ffffff",
  ink: "#111318",
  muted: "#4a4f5a",
  subtle: "#8a8f99",
  line: "#e6e7eb",
  dark: "#07090E",
  darkInk: "#EDEDF0",
  accent: "#34A853",
};

const numberFormat = new Intl.NumberFormat("en-US");

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function providerLabels(ids: readonly CloudProviderId[]): string {
  const labels = CLOUD_PROVIDERS.filter((p) => ids.includes(p.id)).map((p) => p.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/** e.g. "Nov 20, 2026, 11:42 PM UTC" — in MAIL_TIMEZONE if set (e.g. Asia/Kolkata). */
export function formatJoinedAt(iso: string, timeZone = process.env.MAIL_TIMEZONE?.trim() || "UTC"): string {
  const date = new Date(iso);
  const opts = { dateStyle: "medium", timeStyle: "short" } as const;
  try {
    return `${new Intl.DateTimeFormat("en-US", { ...opts, timeZone }).format(date)} ${shortZone(date, timeZone)}`;
  } catch {
    // Unknown time zone name — fall back to UTC rather than failing the email.
    return `${new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(date)} UTC`;
  }
}

function shortZone(date: Date, timeZone: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

/** Round-number signups worth celebrating in the owner notification. */
function milestone(position: number): string | null {
  const marks = [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  if (marks.includes(position) || (position > 10000 && position % 10000 === 0)) {
    return position === 1 ? "Your very first signup." : `You just reached ${numberFormat.format(position)} signups.`;
  }
  return null;
}

/** Hidden inbox-preview line shown next to the subject in most mail apps. */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(text)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>`;
}

function layout(title: string, preview: string, body: string, footer: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
  ${preheader(preview)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.card};border:1px solid ${C.line};border-radius:12px;overflow:hidden;font-family:${FONT};color:${C.ink};">
          <tr>
            <td style="background:${C.dark};padding:18px 28px;">
              <span style="font-size:15px;font-weight:600;color:${C.darkInk};letter-spacing:-0.01em;">HyperDrive</span>
              <span style="font-family:${MONO};font-size:12px;color:#969BA6;padding-left:8px;">H:\\</span>
            </td>
          </tr>
${body}
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td style="padding:16px 28px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.subtle};text-align:center;">${footer}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:${C.ink};">
                    <a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 20px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
                  </td>
                </tr>
              </table>`;
}

function providerChips(ids: readonly CloudProviderId[]): string {
  return CLOUD_PROVIDERS.filter((p) => ids.includes(p.id))
    .map(
      (p) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border:1px solid ${C.line};border-radius:999px;font-size:13px;color:${C.ink};white-space:nowrap;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;vertical-align:1px;"></span>${escapeHtml(p.label)}</span>`,
    )
    .join("");
}

/* ── Owner notification ──────────────────────────────────────────────────── */

export function notificationEmail(s: SignupDetails): EmailContent {
  const position = numberFormat.format(s.position);
  const total = s.total === undefined ? null : numberFormat.format(s.total);
  const joined = formatJoinedAt(s.joinedAt);
  const clouds = providerLabels(s.providers);
  const celebrate = milestone(s.position);
  const e = escapeHtml(s.email);
  const reply = `mailto:${encodeURIComponent(s.email)}?subject=${encodeURIComponent("Your HyperDrive early access")}`;

  const subject = `New signup #${position} · ${s.email}`;

  const text = [
    `New HyperDrive waitlist signup #${position}`,
    ...(celebrate ? ["", celebrate] : []),
    "",
    `Email:   ${s.email}`,
    `Clouds:  ${clouds}`,
    `Joined:  ${joined}`,
    ...(total ? [`Total:   ${total} on the waitlist`] : []),
    "",
    "Reply to this email to write to them directly.",
  ].join("\n");

  const row = (label: string, value: string) => `
                <tr>
                  <td style="padding:12px 0;border-top:1px solid ${C.line};font-size:13px;color:${C.subtle};width:84px;vertical-align:top;">${label}</td>
                  <td style="padding:12px 0;border-top:1px solid ${C.line};font-size:14px;color:${C.ink};vertical-align:top;">${value}</td>
                </tr>`;

  const body = `
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.accent};">● New waitlist signup</p>
              <p style="margin:10px 0 0;font-size:40px;line-height:1;font-weight:700;letter-spacing:-0.03em;color:${C.ink};">#${position}</p>
              ${total ? `<p style="margin:8px 0 0;font-size:14px;color:${C.muted};">${total} ${s.total === 1 ? "person" : "people"} on the waitlist now</p>` : ""}
            </td>
          </tr>${
            celebrate
              ? `
          <tr>
            <td style="padding:12px 28px 0;">
              <p style="margin:0;padding:10px 14px;border-radius:8px;background:#eef8f1;font-size:14px;font-weight:500;color:#1e6b34;">🎉 ${escapeHtml(celebrate)}</p>
            </td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding:20px 28px 4px;">
              <p style="margin:0 0 4px;font-size:13px;color:${C.subtle};">Email</p>
              <p style="margin:0;font-size:18px;font-weight:600;word-break:break-all;"><a href="mailto:${encodeURIComponent(s.email)}" style="color:${C.ink};text-decoration:none;">${e}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-bottom:1px solid ${C.line};font-family:${FONT};">${row(
                "Clouds",
                providerChips(s.providers),
              )}${row("Joined", escapeHtml(joined))}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 28px;">
              ${button(reply, "Reply to them")}
            </td>
          </tr>`;

  const footer = "Sent by your HyperDrive site for each new signup. Turn it off by clearing WAITLIST_NOTIFY_EMAIL.";

  return {
    subject,
    text,
    html: layout(subject, `${s.email} · ${clouds}${total ? ` · ${total} on the waitlist` : ""}`, body, footer),
  };
}

/* ── Subscriber confirmation ─────────────────────────────────────────────── */

/** Public site URL for links in emails, or null when unset / pointing at localhost. */
function publicSiteUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (!url || /\/\/(localhost|127\.0\.0\.1)(:|$)/.test(url)) return null;
  return url;
}

/** Dark palette for the subscriber mailer (matches the landing page). */
const D = {
  page: "#0B0D12",
  card: "#07090E",
  panel: "#10131A",
  line: "#1F232C",
  ink: "#EDEDF0",
  muted: "#969BA6",
  subtle: "#5F6571",
  accent: "#4ADE80",
};

export function confirmationEmail(s: SignupDetails): EmailContent {
  const position = numberFormat.format(s.position);
  const clouds = providerLabels(s.providers);
  const site = publicSiteUrl();
  const subject = `You're #${position} on the HyperDrive waitlist`;
  const preview = `Your spot is saved. ${clouds} → one H:\\ drive, coming to Windows.`;

  const text = [
    `You're #${position} on the HyperDrive waitlist.`,
    "",
    `Thanks for signing up. When the Windows alpha is ready, we'll send you an installer that mounts ${clouds} as a single H:\\ drive in File Explorer.`,
    "",
    "What happens next",
    "1. We finish the Windows alpha.",
    "2. You get one email with your invite and installer.",
    "3. Sign in to your clouds. They show up as H:\\ and files stream as you open them.",
    "",
    ...(site ? [`See how it works: ${site}/#how-it-works`, ""] : []),
    "That's the only email you'll get until then. Reply \"remove\" to leave the list.",
    "",
    "— HyperDrive",
  ].join("\n");

  const folderRows = CLOUD_PROVIDERS.filter((p) => s.providers.includes(p.id))
    .map(
      (p) => `
                      <tr>
                        <td style="padding:9px 14px;border-top:1px solid ${D.line};font-family:${FONT};font-size:14px;color:${D.ink};">
                          <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${p.color};margin-right:10px;vertical-align:-1px;"></span>${escapeHtml(p.label)}
                        </td>
                        <td align="right" style="padding:9px 14px;border-top:1px solid ${D.line};font-family:${MONO};font-size:11px;color:${D.subtle};white-space:nowrap;">☁ on demand</td>
                      </tr>`,
    )
    .join("");

  const step = (n: string, title: string, body: string) => `
                <tr>
                  <td width="40" valign="top" style="padding:0 0 18px;font-family:${MONO};font-size:13px;color:${D.accent};">${n}</td>
                  <td valign="top" style="padding:0 0 18px;font-family:${FONT};">
                    <p style="margin:0;font-size:15px;font-weight:600;color:${D.ink};">${title}</p>
                    <p style="margin:4px 0 0;font-size:14px;line-height:1.55;color:${D.muted};">${body}</p>
                  </td>
                </tr>`;

  const cta = site
    ? `
          <tr>
            <td style="padding:8px 32px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:${D.ink};">
                    <a href="${escapeHtml(`${site}/#how-it-works`)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:14px;font-weight:600;color:${D.card};text-decoration:none;border-radius:8px;">See how it works →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${D.page};-webkit-text-size-adjust:100%;">
  ${preheader(preview)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${D.page}" style="background:${D.page};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${D.card}" style="max-width:560px;background:${D.card};border:1px solid ${D.line};border-radius:16px;overflow:hidden;font-family:${FONT};color:${D.ink};">

          <!-- Brand bar -->
          <tr>
            <td style="padding:22px 32px;border-bottom:1px solid ${D.line};">
              <span style="font-size:15px;font-weight:600;letter-spacing:-0.01em;color:${D.ink};">HyperDrive</span>
              <span style="font-family:${MONO};font-size:12px;color:${D.subtle};padding-left:8px;">H:\\</span>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td bgcolor="${D.card}" style="padding:44px 32px 36px;background-color:${D.card};background-image:radial-gradient(ellipse at top left,#14324A 0%,${D.card} 65%);">
              <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${D.accent};">● Spot saved</p>
              <p style="margin:14px 0 0;font-size:30px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:${D.ink};">You're on the list.</p>
              <p style="margin:24px 0 0;font-size:13px;color:${D.muted};">Your place in line</p>
              <p style="margin:2px 0 0;font-size:64px;line-height:1;font-weight:700;letter-spacing:-0.04em;color:${D.ink};">#${position}</p>
              <p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:${D.muted};">
                When the Windows alpha is ready, you'll get an installer that mounts ${escapeHtml(clouds)} as one
                <span style="font-family:${MONO};color:${D.ink};">H:\\</span> drive in File Explorer. Files stream in as you open them, so nothing downloads upfront.
              </p>
            </td>
          </tr>

          <!-- Drive preview -->
          <tr>
            <td style="padding:0 32px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${D.panel}" style="background:${D.panel};border:1px solid ${D.line};border-radius:10px;border-collapse:separate;">
                <tr>
                  <td colspan="2" style="padding:10px 14px;font-family:${MONO};font-size:12px;color:${D.muted};">
                    <span style="color:${D.ink};">H:\\</span>&nbsp;&nbsp;HyperDrive
                  </td>
                </tr>${folderRows}
              </table>
              <p style="margin:10px 0 0;font-size:12px;color:${D.subtle};">Your clouds, as they'll appear in File Explorer.</p>
            </td>
          </tr>

          <!-- What happens next -->
          <tr>
            <td style="padding:32px 32px 14px;border-top:1px solid ${D.line};">
              <p style="margin:0 0 20px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${D.subtle};">What happens next</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${step(
                "01",
                "We finish the Windows alpha",
                "WinFsp driver, range-request streaming and the local chunk cache are in progress.",
              )}${step("02", "You get one invite email", "With the installer and a short setup guide. No newsletters in between.")}${step(
                "03",
                "Your clouds become H:\\",
                "Sign in once. Open, search and save files from any app, just like a local disk.",
              )}
              </table>
            </td>
          </tr>${cta}
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:20px 32px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${D.subtle};text-align:center;">
              You're receiving this because this address joined the HyperDrive waitlist.<br>
              Didn't sign up, or changed your mind? Reply "remove" and we'll take you off the list.
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
