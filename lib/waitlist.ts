/**
 * Shared waitlist contract — safe to import from both client and server code.
 * Server-only persistence lives in `lib/waitlist-store.ts`.
 */

export const CLOUD_PROVIDERS = [
  { id: "google-drive", label: "Google Drive", color: "#34A853" },
  { id: "dropbox", label: "Dropbox", color: "#0061FF" },
  { id: "onedrive", label: "OneDrive", color: "#0EA5E9" },
] as const;

export type CloudProviderId = (typeof CLOUD_PROVIDERS)[number]["id"];

export const MAX_EMAIL_LENGTH = 254;

export interface WaitlistRequest {
  email: string;
  providers: CloudProviderId[];
}

export type WaitlistField = "email" | "providers";

export type WaitlistResponse =
  | {
      ok: true;
      email: string;
      providers: CloudProviderId[];
      /** 1-based position in the early-access queue. */
      position: number;
      total: number;
      alreadyJoined: boolean;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<WaitlistField, string>>;
    };

export interface WaitlistStats {
  total: number;
}

/**
 * WHATWG HTML `type="email"` grammar (what browsers enforce), plus a required
 * dot-separated TLD of 2+ letters. Rejects `<>`, quotes, commas, etc., which
 * would otherwise end up in outgoing mail headers.
 */
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
const PROVIDER_IDS = new Set<string>(CLOUD_PROVIDERS.map((p) => p.id));

export function isCloudProviderId(value: unknown): value is CloudProviderId {
  return typeof value === "string" && PROVIDER_IDS.has(value);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return "Enter your email address.";
  if (value.length > MAX_EMAIL_LENGTH) return "That email address is too long.";
  if (!EMAIL_PATTERN.test(value)) return "Enter a valid email address.";
  return null;
}

export function validateProviders(providers: readonly unknown[]): string | null {
  if (providers.length === 0) return "Pick at least one cloud provider.";
  if (!providers.every(isCloudProviderId)) return "Unknown cloud provider selected.";
  return null;
}

export type ValidationResult =
  | { success: true; data: WaitlistRequest }
  | { success: false; fieldErrors: Partial<Record<WaitlistField, string>> };

/** Validates an untrusted JSON payload into a normalized `WaitlistRequest`. */
export function validateWaitlistPayload(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, fieldErrors: { email: "Invalid request body." } };
  }

  const { email, providers } = input as Record<string, unknown>;
  const fieldErrors: Partial<Record<WaitlistField, string>> = {};

  const emailError =
    typeof email === "string" ? validateEmail(email) : "Enter your email address.";
  if (emailError) fieldErrors.email = emailError;

  const providerList = Array.isArray(providers) ? providers : [];
  const providerError = validateProviders(providerList);
  if (providerError) fieldErrors.providers = providerError;

  if (fieldErrors.email || fieldErrors.providers) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      email: normalizeEmail(email as string),
      // De-duplicate and keep canonical ordering.
      providers: CLOUD_PROVIDERS.map((p) => p.id).filter((id) =>
        (providerList as string[]).includes(id),
      ),
    },
  };
}

/** DOM ids shared by the navbar CTA and the hero form. */
export const WAITLIST_SECTION_ID = "waitlist";
export const WAITLIST_EMAIL_INPUT_ID = "waitlist-email";
