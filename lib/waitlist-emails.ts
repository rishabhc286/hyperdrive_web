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

export function confirmationEmail(s: SignupDetails): EmailContent {
  const position = numberFormat.format(s.position);
  const clouds = providerLabels(s.providers);
  const subject = `You're on the HyperDrive waitlist (#${position})`;

  const text = [
    "Thanks for joining the HyperDrive waitlist.",
    "",
    `You're #${position} in line. When the Windows alpha is ready, we'll email you an installer that mounts ${clouds} as a single H:\\ drive in File Explorer.`,
    "",
    "That's the only email you'll get until then.",
    "",
    "— HyperDrive",
  ].join("\n");

  const body = `
          <tr>
            <td style="padding:28px 28px 28px;">
              <p style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:600;">You're on the waitlist — #${position}.</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.muted};">
                When the Windows alpha is ready, we'll email you an installer that mounts ${escapeHtml(clouds)} as a single
                <code style="font-family:${MONO};color:${C.ink};">H:\\</code> drive in File Explorer.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:${C.muted};">That's the only email you'll get until then.</p>
            </td>
          </tr>`;

  return {
    subject,
    text,
    html: layout(
      subject,
      `You're #${position} in line for the Windows alpha.`,
      body,
      "You received this because this address was entered on the HyperDrive waitlist.",
    ),
  };
}
