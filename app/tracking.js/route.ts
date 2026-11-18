/*
 * The ad platform tags' starter (lib/tracking.ts), from this site so the pages need no inline script.
 * Read per request: the ids come from the server's settings.
 */
import { trackingIds, trackingScript } from '@/lib/tracking';

export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(trackingScript(trackingIds()), {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
  });
}
