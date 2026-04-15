import { Resend } from "resend";

/**
 * Lazily-initialised Resend client.
 *
 * A module-level singleton is fine here — the API key is constant for the
 * lifetime of the server process and Resend itself is stateless per request.
 *
 * Returns null when RESEND_API_KEY is not set so callers can no-op gracefully
 * in local dev without crashing.
 */
let _client: Resend | null = null;

export function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
}
