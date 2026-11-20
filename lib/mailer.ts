import nodemailer, { type Transporter } from "nodemailer";
import { confirmationEmail, notificationEmail, type SignupDetails } from "@/lib/waitlist-emails";

/**
 * Waitlist email delivery over SMTP (Gmail by default), configured entirely
 * through environment variables — see `.env.example`. Server-only.
 * Email content lives in `lib/waitlist-emails.ts`.
 *
 * Required:  SMTP_USER, SMTP_PASS (a Google App Password for Gmail)
 * Optional:  SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), MAIL_FROM_NAME (HyperDrive),
 *            WAITLIST_NOTIFY_EMAIL (also send yourself a note for every signup),
 *            MAIL_TIMEZONE (UTC; time zone for the "Joined" time in that note)
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

export type WaitlistEmailInput = SignupDetails;

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

  const jobs: Promise<unknown>[] = [transporter.sendMail({ from, to: entry.email, ...confirmationEmail(entry) })];

  if (config.notifyTo) {
    jobs.push(transporter.sendMail({ from, to: config.notifyTo, replyTo: entry.email, ...notificationEmail(entry) }));
  }

  const results = await Promise.allSettled(jobs);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[waitlist] Failed to send email:", result.reason instanceof Error ? result.reason.message : result.reason);
    }
  }
}
