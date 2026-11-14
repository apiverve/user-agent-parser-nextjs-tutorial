import { createHash } from 'node:crypto';
import { callApi, fail, fromCache, guard, respond, str, toCache } from '@/lib/apiverve';

// POST /api/parse { ua }      parses the given user agent string
// POST /api/parse { mine: 1 } parses the visitor's own, read from the request headers
// User agents repeat a lot, so answers are cached for a day.
const TTL_MS = 24 * 60 * 60_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ua = body?.mine ? str(request.headers.get('user-agent'), 1000) : str(body?.ua, 1000);
  if (!ua) return fail('Paste a user agent string to parse');

  const key = `ua:${createHash('sha1').update(ua).digest('hex')}`;
  const hit = fromCache(key, TTL_MS);
  if (hit) return Response.json(hit);

  const blocked = guard(request);
  if (blocked) return blocked;

  return respond(async () => {
    const data = await callApi('useragentparser', { json: { ua } });
    toCache(key, data);
    return data;
  });
}
