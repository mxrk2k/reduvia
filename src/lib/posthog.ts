import { PostHog } from "posthog-node";

// ── Singleton client ──────────────────────────────────────────────────────────
//
// flushAt: 1  → flush after every event (no batching)
// flushInterval: 0 → disable timer-based flushing
//
// Both settings are required for serverless environments where the process
// may be terminated before a batch is naturally flushed.

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  if (!_client) {
    _client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return _client;
}

// ── Public helper ─────────────────────────────────────────────────────────────

/**
 * Capture a server-side PostHog event and flush immediately.
 *
 * Safe to call from Server Actions, Route Handlers, and server components.
 * No-ops gracefully when NEXT_PUBLIC_POSTHOG_KEY is not set.
 *
 * @param distinctId - The user's Supabase UUID (use user.id)
 * @param event      - Snake_case event name, e.g. "user_signed_up"
 * @param properties - Optional key/value metadata attached to the event
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    client.capture({ distinctId, event, properties: properties ?? {} });
    await client.flush();
  } catch {
    // Never let analytics errors surface to users
  }
}
