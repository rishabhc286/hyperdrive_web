import nodemailer, { type Transporter } from "nodemailer";
import { CLOUD_PROVIDERS, type CloudProviderId } from "@/lib/waitlist";

/**
 * Waitlist email delivery over SMTP (Gmail by default), configured entirely
 * through environment variables — see `.env.example`. Server-only.
 *
 * Required:  SMTP_USER, SMTP_PASS (a Google App Password for Gmail)
 * Optional:  SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), MAIL_FROM_NAME (HyperDrive),
 *            WAITLIST_NOTIFY_EMAIL (also send yourself a note for every signup)
 */

interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  notifyTo: string | null;
}

function readConfig(): MailConfig | null {
  const user = process.env.SMTP_USER?.trim();
  // Google shows App Passwords in groups of four ("abcd efgh ijkl mnop"); spaces aren't part of it.
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    user,
    pass,
    fromName: process.env.MAIL_FROM_NAME?.trim() || "HyperDrive",
    notifyTo: process.env.WAITLIST_NOTIFY_EMAIL?.trim() || null,
  };
}

const globalForMail = globalThis as typeof globalThis & {
  __hyperdriveMail?: { transporter: Transporter; key: string };
  __hyperdriveMailWarned?: boolean;
};

function getTransporter(config: MailConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.user}`;
  const cached = globalForMail.__hyperdriveMail;
  if (cached && cached.key === key) return cached.transporter;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465, // 465 = implicit TLS; 587 upgrades via STARTTLS
    auth: { user: config.user, pass: config.pass },
  });
  globalForMail.__hyperdriveMail = { transporter, key };
  return transporter;
}

export function isMailConfigured(): boolean {
  return readConfig() !== null;
}

export interface WaitlistEmailInput {
  email: string;
  providers: CloudProviderId[];
  position: number;
}

/**
 * Sends the signup confirmation (and optional owner notification).
 * Never throws: email problems must not break a signup that already succeeded.
 */
export async function sendWaitlistEmails(entry: WaitlistEmailInput): Promise<void> {
  const config = readConfig();
  if (!config) {
    if (!globalForMail.__hyperdriveMailWarned) {
      globalForMail.__hyperdriveMailWarned = true;
      console.warn("[waitlist] SMTP_USER / SMTP_PASS not set — skipping waitlist emails. See .env.example.");
    }
    return;
  }

  const transporter = getTransporter(config);
  const from = { name: config.fromName, address: config.user };
  const providers = providerLabels(entry.providers);
  const position = new Intl.NumberFormat("en-US").format(entry.position);

  const jobs: Promise<unknown>[] = [
    transporter.sendMail({
      from,
      to: entry.email,
      subject: `You're on the HyperDrive waitlist (#${position})`,
      text: confirmationText(position, providers),
      html: confirmationHtml(position, providers),
    }),
  ];

  if (config.notifyTo) {
    jobs.push(
      transporter.sendMail({
        from,
        to: config.notifyTo,
        replyTo: entry.email,
        subject: `New waitlist signup #${position}: ${entry.email}`,
        text: `${entry.email} joined the HyperDrive waitlist.\n\nPosition: #${position}\nClouds: ${providers}\n`,
      }),
    );
  }

  const results = await Promise.allSettled(jobs);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[waitlist] Failed to send email:", result.reason instanceof Error ? result.reason.message : result.reason);
    }
  }
}

/* ── Content ─────────────────────────────────────────────────────────────── */

function providerLabels(ids: CloudProviderId[]): string {
  const labels = CLOUD_PROVIDERS.filter((p) => ids.includes(p.id)).map((p) => p.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

function confirmationText(position: string, providers: string): string {
  return [
    "Thanks for joining the HyperDrive waitlist.",
    "",
    `You're #${position} in line. When the Windows alpha is ready, we'll email you an installer that mounts ${providers} as a single H:\\ drive in File Explorer.`,
    "",
    "That's the only email you'll get until then.",
    "",
    "— HyperDrive",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function confirmationHtml(position: string, providers: string): string {
  const p = escapeHtml(providers);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111318;">
    <div style="max-width:480px;margin:0 auto;">
      <p style="margin:0 0 24px;font-size:15px;font-weight:600;">HyperDrive</p>
      <p style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:500;">You're on the waitlist — #${position}.</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4f5a;">
        When the Windows alpha is ready, we'll email you an installer that mounts ${p} as a single
        <code style="font-family:Consolas,monospace;color:#111318;">H:\\</code> drive in File Explorer.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#4a4f5a;">That's the only email you'll get until then.</p>
      <p style="margin:32px 0 0;font-size:13px;color:#8a8f99;">You received this because this address was entered on the HyperDrive waitlist.</p>
    </div>
  </body>
</html>`;
}
