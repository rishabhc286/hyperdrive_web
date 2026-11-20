import { after, connection } from "next/server";
import { addToWaitlist, getWaitlistTotal, type StoredEntry } from "@/lib/waitlist-store";
import { sendWaitlistEmails } from "@/lib/mailer";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  validateWaitlistPayload,
  type WaitlistResponse,
  type WaitlistStats,
} from "@/lib/waitlist";

const MAX_BODY_BYTES = 4 * 1024;
const UNAVAILABLE = "The waitlist is temporarily unavailable. Please try again in a moment.";
/** Signups allowed per IP per window — each one can trigger an email from your account. */
const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 10 * 60 * 1000;
const NO_STORE = { "Cache-Control": "no-store" } as const;

type FieldErrors = Extract<WaitlistResponse, { ok: false }>["fieldErrors"];

function fail(status: number, error: string, fieldErrors?: FieldErrors) {
  const body: WaitlistResponse = { ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) };
  return Response.json(body, { status, headers: NO_STORE });
}

/** Reads the body as UTF-8, aborting (→ null) as soon as it exceeds `limit` bytes. */
async function readBodyWithLimit(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** GET /api/waitlist — live waitlist size for the hero counter. */
export async function GET() {
  // Opt out of prerendering (Cache Components): the count changes at runtime.
  await connection();
  try {
    const body: WaitlistStats = { total: await getWaitlistTotal() };
    return Response.json(body, { headers: NO_STORE });
  } catch (err) {
    console.error("[waitlist] Failed to read total:", err instanceof Error ? err.message : err);
    return fail(503, UNAVAILABLE);
  }
}

/** POST /api/waitlist — join the early-access queue. */
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail(415, "Expected a JSON request body.");
  }

  const limited = rateLimit(`waitlist:${clientIp(request)}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
  if (!limited.ok) {
    const body: WaitlistResponse = { ok: false, error: "Too many signups from this network. Please try again in a few minutes." };
    return Response.json(body, {
      status: 429,
      headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSeconds) },
    });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return fail(413, "Request body is too large.");
  }

  // Content-Length can be absent (chunked) or lie, so enforce the cap while streaming.
  const raw = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (raw === null) return fail(413, "Request body is too large.");

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return fail(400, "Request body must be valid JSON.");
  }

  // Honeypot: real users never see or fill the `website` field. Pretend success so
  // bots get no signal, but store nothing.
  const website =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>).website
      : undefined;
  if (typeof website === "string" && website.trim() !== "") {
    const total = 0; // never touch the database for bots
    const body: WaitlistResponse = {
      ok: true,
      email: "",
      providers: [],
      position: total + 1,
      total,
      alreadyJoined: false,
    };
    return Response.json(body, { status: 201, headers: NO_STORE });
  }

  const result = validateWaitlistPayload(payload);
  if (!result.success) {
    return fail(422, "Please fix the highlighted fields.", result.fieldErrors);
  }

  let entry: StoredEntry;
  let total: number;
  try {
    entry = await addToWaitlist(result.data);
    total = await getWaitlistTotal();
  } catch (err) {
    console.error("[waitlist] Failed to save signup:", err instanceof Error ? err.message : err);
    return fail(503, UNAVAILABLE);
  }

  // Email only genuinely new signups, after the response is sent so SMTP latency
  // never slows the form down.
  if (!entry.alreadyJoined) {
    after(() =>
      sendWaitlistEmails({ email: entry.email, providers: entry.providers, position: entry.position }),
    );
  }

  const body: WaitlistResponse = {
    ok: true,
    email: entry.email,
    providers: entry.providers,
    position: entry.position,
    total,
    alreadyJoined: entry.alreadyJoined,
  };
  return Response.json(body, { status: entry.alreadyJoined ? 200 : 201, headers: NO_STORE });
}
