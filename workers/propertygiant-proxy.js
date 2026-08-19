/**
 * Cloudflare Worker — serves this app's /check-in from www.propertygiant.com
 * directly, replacing the Webflow iframe embed.
 *
 * propertygiant.com already proxies through Cloudflare (Webflow is the origin),
 * so this Worker sits in front of a small allowlist of paths and forwards them
 * to Railway. Every other URL on the zone is untouched and served by Webflow.
 *
 * Paths are identical on both sides (/check-in -> /check-in), so the Next.js app
 * needs no basePath / assetPrefix change.
 *
 * Deploy: Cloudflare dashboard -> Workers & Pages -> this Worker -> paste + Deploy,
 * then bind the routes listed in ROUTES below. Removing the routes reverts to
 * the Webflow page instantly.
 */

const ORIGIN = "https://openhouse-reporting-v5-production.up.railway.app";

/**
 * Routes to bind in the dashboard (all on zone propertygiant.com):
 *   www.propertygiant.com/check-in*
 *   www.propertygiant.com/_next/*
 *   www.propertygiant.com/api/checkin
 *   www.propertygiant.com/api/properties
 *   www.propertygiant.com/api/agents
 */

// Prefix matches — /check-in and everything Next serves for it.
const PROXY_PREFIXES = ["/check-in", "/_next/"];

// Exact matches only. Deliberately NOT a blanket /api/* so this Worker can
// never shadow a future Webflow path.
const PROXY_EXACT = ["/api/checkin", "/api/properties", "/api/agents"];

// NOTE: /report and /leads are intentionally NOT proxied. They are internal,
// unauthenticated, and /leads exposes lead PII — putting them on the public
// marketing domain would make them trivially discoverable. Add auth first.

function shouldProxy(pathname) {
  return (
    PROXY_EXACT.includes(pathname) ||
    PROXY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))
  );
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Defensive: if a route pattern is ever broadened by accident, fall through
    // to Webflow rather than proxying the whole marketing site.
    if (!shouldProxy(url.pathname)) {
      return fetch(request);
    }

    const target = new URL(url.pathname + url.search, ORIGIN);
    const proxied = new Request(target, request);
    proxied.headers.set("X-Forwarded-Host", url.host);
    proxied.headers.set("X-Forwarded-Proto", "https");

    // Handle redirects here so a 3xx from Next never surfaces the railway.app
    // hostname in the browser's address bar.
    const res = await fetch(proxied, { redirect: "manual" });

    const location = res.headers.get("Location");
    if (location && location.startsWith(ORIGIN)) {
      const headers = new Headers(res.headers);
      headers.set("Location", location.replace(ORIGIN, `https://${url.host}`));
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    }

    return res;
  },
};
