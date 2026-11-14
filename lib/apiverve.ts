// Server-side helpers for the app/api routes. Nothing here reaches the browser:
// the page only ever calls /api routes, and the key stays in the environment.
//
// Set APIVERVE_API_KEY in .env (local) or in your Vercel project's environment variables.
// Get a free key at https://dashboard.apiverve.com

// ============================================
// Rate limit and cache
// Once deployed, anyone who finds this URL can call it with YOUR key.
// Each visitor gets RATE_LIMIT uncached requests per minute, and answers are
// cached so repeat lookups cost nothing. Both live in memory, so they reset on
// cold starts and aren't shared between instances: good enough for a demo. For
// production, use a shared store (e.g. Upstash Redis) or put the app behind
// your own auth.
// ============================================
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();
const cache = new Map<string, { at: number; data: unknown }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_LIMIT;
}

/** A JSON error response. `code` lets the page tell errors apart, e.g. "missing_key". */
export const fail = (error: string, status = 400, code?: string) =>
  Response.json(code ? { error, code } : { error }, { status });

/** Every route calls this before spending credits: it needs the key, and counts against the visitor's limit. */
export function guard(request: Request) {
  if (!process.env.APIVERVE_API_KEY) {
    return fail('Missing APIVERVE_API_KEY. Add it to .env, or to your Vercel project’s environment variables, then redeploy.', 500, 'missing_key');
  }
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  if (rateLimited(ip)) return fail('Too many requests. Wait a minute and try again.', 429);
  return null;
}

type CallOptions = { query?: Record<string, string>; json?: unknown; form?: FormData };

/**
 * Calls an APIVerve API and returns its data, or throws with its error message.
 * Pass query for a GET, json for a JSON POST, or form (FormData) for a file upload.
 */
export async function callApi<T = Record<string, unknown>>(api: string, { query, json, form }: CallOptions = {}): Promise<T> {
  const url = `https://api.apiverve.com/v1/${api}${query ? `?${new URLSearchParams(query)}` : ''}`;
  const headers: Record<string, string> = { 'x-api-key': process.env.APIVERVE_API_KEY || '' };
  if (json) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method: json || form ? 'POST' : 'GET',
    headers,
    body: json ? JSON.stringify(json) : form,
    cache: 'no-store'
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status !== 'ok') {
    const err = body?.error;
    const message = err?.missing ? `Missing: ${err.missing.join(', ')}` : typeof err === 'string' ? err : `APIVerve returned ${res.status}`;
    throw Object.assign(new Error(message), { status: res.status === 429 ? 429 : 502 });
  }
  return body.data as T;
}

/** The cached answer for key if it's younger than ttlMs, or null. A hit costs no credits and skips the rate limit. */
export function fromCache<T>(key: string, ttlMs: number): T | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < ttlMs ? (hit.data as T) : null;
}

export function toCache(key: string, data: unknown) {
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), data });
}

/** Runs a route body, turning a thrown callApi error into a JSON response. */
export async function respond(work: () => Promise<unknown>) {
  try {
    return Response.json(await work());
  } catch (err) {
    const e = err as Error & { status?: number };
    return fail(e.message || 'Something went wrong', e.status || 500);
  }
}

/** A trimmed string, capped at max characters. */
export const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
