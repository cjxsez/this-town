/**
 * routes/media.ts: media files kept out of git, served from the R2 bucket `questline-media`
 * (binding MEDIA). Today that is the waiting song the phone plays (apps/phone-web/src/lib/
 * music.ts), a commercial track that must not sit in the public repo.
 *
 * The phone asks for /sounds/waiting.m4a. A build that has the file (local dev, or a deploy
 * from a machine that has it) serves it as a static asset before this runs. A build from
 * GitHub (the auto-deploy) has no such file, so the request falls through to here and the
 * song comes from R2 instead, and auto-deploys never lose it.
 *
 * Range requests get 206 + Content-Range: iOS Safari will not play audio without them.
 *
 * Upload or replace a file (once, from a machine that has it):
 *   wrangler r2 object put questline-media/sounds/waiting.m4a --file <file> \
 *     --content-type audio/mp4 --remote
 */
import { Hono } from "hono";
import type { AppEnv } from "../env";

/** URL path -> R2 key. Only these are served. */
const MEDIA: Record<string, string> = {
  "/sounds/waiting.m4a": "sounds/waiting.m4a",
};

export const mediaRoutes = new Hono<AppEnv>();

for (const [path, key] of Object.entries(MEDIA)) {
  mediaRoutes.get(path, async (c) => {
    const bucket = c.env.MEDIA;
    if (!bucket) return c.text("not found", 404);
    const range = c.req.header("range");
    const obj = await bucket.get(key, range ? { range: c.req.raw.headers } : undefined);
    if (!obj) return c.text("not found", 404);

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("accept-ranges", "bytes");
    if (!headers.has("content-type")) headers.set("content-type", "audio/mp4");
    if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=86400");

    const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
    if (range && r) {
      const offset = r.suffix != null ? obj.size - r.suffix : (r.offset ?? 0);
      const length = r.suffix != null ? r.suffix : (r.length ?? obj.size - offset);
      headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
      headers.set("content-length", String(length));
      return new Response(obj.body, { status: 206, headers });
    }
    headers.set("content-length", String(obj.size));
    return new Response(obj.body, { headers });
  });
}
