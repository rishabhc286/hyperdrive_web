"use client";

import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import {
  CLOUD_PROVIDERS,
  validateEmail,
  validateProviders,
  type CloudProviderId,
  type WaitlistField,
  type WaitlistResponse,
} from "@/lib/waitlist";

type Success = Extract<WaitlistResponse, { ok: true }>;
type FieldErrors = Partial<Record<WaitlistField, string>>;

const numberFormat = new Intl.NumberFormat("en-US");

interface WaitlistFormProps {
  /** id of the email input — also used to namespace every other DOM id in the form. */
  inputId: string;
  /** Optional id on the wrapper so in-page links (e.g. `#waitlist`) can target it. */
  anchorId?: string;
  /** Called with the new waitlist total after a successful signup. */
  onTotalChange?: (total: number) => void;
}

/**
 * Early-access signup: provider toggles + email, posting to `/api/waitlist`.
 * Safe to render more than once per page (hero + bottom CTA).
 */
export function WaitlistForm({ inputId, anchorId, onTotalChange }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [providers, setProviders] = useState<CloudProviderId[]>([]);
  const [website, setWebsite] = useState(""); // honeypot
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);

  const ids = {
    email: inputId,
    emailError: `${inputId}-error`,
    providersError: `${inputId}-providers-error`,
    privacy: `${inputId}-privacy`,
  };

  const toggleProvider = (id: CloudProviderId) => {
    setProviders((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    setFieldErrors((prev) => ({ ...prev, providers: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const clientErrors: FieldErrors = {};
    const emailError = validateEmail(email);
    const providerError = validateProviders(providers);
    if (emailError) clientErrors.email = emailError;
    if (providerError) clientErrors.providers = providerError;

    setFormError(null);
    setFieldErrors(clientErrors);
    if (emailError || providerError) {
      if (emailError) document.getElementById(ids.email)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, providers, website }),
      });
      const data = (await res.json()) as WaitlistResponse;

      if (data.ok) {
        setSuccess(data);
        onTotalChange?.(data.total);
      } else {
        setFieldErrors(data.fieldErrors ?? {});
        setFormError(data.fieldErrors ? null : data.error);
      }
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSuccess(null);
    setEmail("");
    setProviders([]);
    setFieldErrors({});
    setFormError(null);
    requestAnimationFrame(() => document.getElementById(ids.email)?.focus());
  };

  return (
    <div id={anchorId} className="relative scroll-mt-24">
      {success ? (
        <SuccessMessage result={success} onReset={reset} />
      ) : (
        <form noValidate onSubmit={handleSubmit} aria-describedby={ids.privacy}>
          {/* Honeypot — hidden from humans and assistive tech */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Website
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          <fieldset aria-describedby={fieldErrors.providers ? ids.providersError : undefined}>
            <legend className="text-sm text-ink-muted">Which clouds do you use?</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {CLOUD_PROVIDERS.map((provider) => {
                const selected = providers.includes(provider.id);
                return (
                  <button
                    key={provider.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleProvider(provider.id)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${
                      selected
                        ? "border-ink/50 text-ink"
                        : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    {selected && <Check className="size-3.5" strokeWidth={2.5} aria-hidden />}
                    {provider.label}
                  </button>
                );
              })}
            </div>
            {fieldErrors.providers && (
              <p id={ids.providersError} role="alert" className="mt-2 text-sm text-rose-400">
                {fieldErrors.providers}
              </p>
            )}
          </fieldset>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor={ids.email} className="sr-only">
              Email address
            </label>
            <input
              id={ids.email}
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? ids.emailError : undefined}
              className={`h-10 w-full min-w-0 rounded-md border bg-transparent px-3 text-[15px] text-ink transition-colors outline-none placeholder:text-ink-subtle focus:border-ink/50 focus-visible:outline-none sm:flex-1 ${
                fieldErrors.email ? "border-rose-400/60" : "border-line-strong"
              }`}
            />
            <button
              type="submit"
              disabled={submitting}
              className="h-10 shrink-0 rounded-md bg-ink px-4 text-sm font-medium text-obsidian transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70"
            >
              {submitting ? "Joining…" : "Join waitlist"}
            </button>
          </div>
          {fieldErrors.email && (
            <p id={ids.emailError} role="alert" className="mt-2 text-sm text-rose-400">
              {fieldErrors.email}
            </p>
          )}
          {formError && (
            <p role="alert" className="mt-2 text-sm text-rose-400">
              {formError}
            </p>
          )}

          <p id={ids.privacy} className="mt-3 text-sm text-ink-subtle">
            One email when your alpha invite is ready. Nothing else.
          </p>
        </form>
      )}
    </div>
  );
}

function SuccessMessage({ result, onReset }: { result: Success; onReset: () => void }) {
  const providerLabels = CLOUD_PROVIDERS.filter((p) => result.providers.includes(p.id)).map((p) => p.label);

  return (
    <div role="status" className="border-l border-ink/40 py-1 pl-5">
      <p className="text-[17px] text-ink">
        {result.alreadyJoined ? "You're already on the list" : "You're on the list"} —{" "}
        <span className="tabular-nums">#{numberFormat.format(result.position)}</span>.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        We&apos;ll email <span className="break-all text-ink">{result.email}</span> when the alpha is ready to mount{" "}
        {providerLabels.join(", ")} as <code className="font-mono text-ink">H:\</code>.
      </p>
      <button type="button" onClick={onReset} className="mt-3 rounded-sm text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
        Add another email
      </button>
    </div>
  );
}
