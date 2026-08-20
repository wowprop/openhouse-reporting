# Open House Reporting — Project Context

Internal tool for the open house team: weekly reporting form, live walk-in lead capture,
and the public open-house check-in form. Backend of record is a Lark Base. Frontend is
Next.js (App Router, TypeScript), deployed on Railway.

## Architecture

- `/report` — weekly report form (Property dropdown, dynamic "+Add" buyer reference rows)
- `/leads` — live-polling table of Walk-in Leads (auto-refreshes every 15s + on tab focus)
- `/check-in` — public visitor registration form, writes directly into Walk-in Leads via
  `/api/checkin`. No Webflow form/webhook involved — Property and Agent are real Lark
  link fields, populated from `/api/properties` and `/api/agents` dropdowns, same pattern
  `/report` already used for Property. **No internal `Nav`** on this page — it's embedded
  standalone (see Embedding below), not part of the internal team's navigation.
- `/` — home page, links to `/report` and `/leads`
- Shared `Nav` component (`src/components/Nav.tsx`) with logo, used on `/report` and `/leads`
  (intentionally NOT on the home page, since home page IS the nav target; also not on
  `/check-in`, see above)

## Embedding into propertygiant.com

Both are iframed from the Webflow marketing site into this app — this app itself has no
public marketing chrome (nav/footer), by design:

- `propertygiant.com/check-in` → iframes this app's `/check-in` (public)
- `propertygiant.com/openhouse-report` → iframes this app's **`/`** (the home page, so the
  team can reach both `/report` and `/leads` via the internal `Nav` inside the frame).
  That Webflow page is password-protected — it is the only access control in front of
  `/report` and `/leads`, which are themselves unauthenticated on the Railway URL.

`next.config.js` sets a `Content-Security-Policy: frame-ancestors` header explicitly
allowing those origins to iframe this app. If the embedding domain ever changes, update
that header or the iframe will render blank. (Verified live: the header allows both
`www.propertygiant.com` and `propertygiant.com`, and no `X-Frame-Options` conflicts.)

### Iframe height contract

`src/components/FrameHeightReporter.tsx` (mounted in the root layout, so it covers every
route) posts `{ type: "openhouse:height", height }` to the parent on every resize. The
Webflow embed listens and sets the iframe's `style.height` from it. Both halves are
required — changing one without the other silently breaks sizing.

The Webflow embed must use `height`, **not** `min-height`: a `min-height` floor stops the
frame from ever shrinking (e.g. back down to the short "You're checked in" state). Do not
set `scrolling="no"` unless the reporter is confirmed live, or a mis-sized frame becomes
unscrollable and users cannot reach the submit button.

Messages are posted to the two propertygiant.com origins explicitly rather than `"*"`, so
height data is never delivered to an unexpected embedder. This also means the mechanism
cannot be tested from a localhost parent — the browser drops those messages by design.

## Lark Base schema

```
app_token: WgVRbO0pSa1WQys2dVLlHyQJgog

Properties        tbly12QHaVv2cqdR   — ongoing open house listings (Address field)
Weekly Report     tble1S4vzSTI4BPy   — Date, Property (link), Submitted By, Groups,
                                        Potential Leads, Buyer Reference (link), Report ID
Buyer References  tblxv34BmZ6YaMkQ   — Last 4 Digits Mobile No., Key Feedback,
                                        Follow Up Status (select), Weekly Report (link back)
Walk-in Leads     tblqDTrCP4R5wEV8   — Name, Contact, Property (link), Served By (link),
                                        Got Agent?, What Brings You Here?, Timeline,
                                        Need to Sell First?, Specific Requirements, NRIC
Agents            tblWqZbUbKbcmVzI   — Name (linked from Walk-in Leads "Served By")
```

Follow Up Status options (exact strings, case-sensitive):
`Not Started`, `In Progress`, `Follow-up Done`, `Not Interested`, `Converted`

## Known gotchas (already solved — don't re-break these)

1. **Lark Date fields want a raw millisecond timestamp, not a formatted string.**
   Send `new Date(...).getTime()`, not a pre-formatted "16 Aug, Sun" string — Lark applies
   its own display formatting based on the field's configured format.
2. **Lark Link fields return structured objects**, not plain strings — e.g.
   `[{"record_ids":[...], "text": "53 Jalan Ketumbit", ...}]`. When displaying these in the
   UI, extract `.text`, don't JSON.stringify the raw value.
3. **Writing to a link field requires an array of record IDs**, not a plain string —
   this is why `/report` and `/check-in` both resolve Property/Agent via a dropdown
   sourced from `/api/properties` / `/api/agents` and submit the `recordId`, rather than
   accepting free text. (We used to receive raw Webflow text for this and couldn't link
   it automatically — that webhook path is gone now that `/check-in` writes directly.)
4. **`FieldNameNotFound` errors mean a field name in the code doesn't exactly match Lark.**
   Always confirm exact field names (including trailing punctuation like "?" or typos
   like the original "Repord ID") against the live table before assuming a code bug.
5. **`.env.example` and `README.md` are intentionally sanitized** (no real IDs, no
   "PropertyGiant" branding) since this repo is public on GitHub. Actual credentials only
   ever live in Railway's environment variables — never commit `.env` itself.
6. **NRIC field is sensitive (PDPA)** — deliberately excluded from the `/leads` table
   view's displayed columns. Still stored in Lark as-is; if that needs tightening, use
   Lark's Advanced Permission field-level restriction, not just hiding it in the UI.
7. **The dropdown API routes need `export const dynamic = "force-dynamic"`.**
   `/api/agents` and `/api/properties` are otherwise candidates for build-time
   prerendering, which bakes the Property/Agent lists into the build — the dropdowns then
   silently show stale data until the next deploy. `/api/leads` already had this.
8. **`globals.css` and `FrameHeightReporter` are coupled.** Every page uses `min-h-screen`,
   which inside an iframe resolves to the frame's *own* height, so the frame could grow but
   never shrink. The reporter adds `.is-embedded` to `<html>` and `globals.css` relaxes
   `min-height` for it. Removing either half reintroduces the stuck-height bug.

## Deployment (Railway)

- Repo: `wowprop/openhouse-reporting` on GitHub, `main` branch
- Currently live service: **openhouse-reporting-v5** (Railway auto-names new services;
  history of dead services from earlier debugging — v1 through v4 — should be deleted
  from the Railway dashboard if not already done)
- **Auto-deploy on push to `main` was broken from the repo recreation until 2026-08-20.**
  Two independent faults were stacked, which is why it looked intermittent rather than
  simply off:
  1. The **Railway GitHub App was never installed** on the `wowprop` account, so Railway
     had no repository access and Settings → Source showed "GitHub Repo not found".
     Note the OAuth authorization at GitHub → Settings → Applications is a *different*
     thing and was present the whole time — it only proves identity, it grants no repo
     access. Check installations at https://github.com/settings/installations; the app is
     https://github.com/apps/railway-app.
  2. **Auto deploy was explicitly disabled** on the branch in Settings → Source.
  Fixing either alone leaves it silently broken. If pushes stop deploying, check both.
- **Leave "Wait for CI" OFF.** The repo has no GitHub Actions workflows, so enabling it
  makes Railway wait for checks that never run and deploys hang indefinitely.
- **`redeploy` reuses the last build snapshot — it does NOT pull fresh from GitHub.**
  If you need to deploy new commits, use a fresh deployment trigger pointed at the repo,
  not a plain redeploy.
- **Fallback: deploy straight from a local checkout with a project token.**
  ```
  RAILWAY_TOKEN=<project-token> railway up -s openhouse-reporting-v5 --ci
  ```
  Project tokens are scoped to a single environment of a single project (create at
  project **Settings → Tokens**) and use `RAILWAY_TOKEN`; `RAILWAY_API_TOKEN` is the
  broader account-level variable and is not needed here. This bypasses GitHub entirely —
  useful when the connection breaks, but note it uploads the **local working tree**, not
  what is on GitHub, so confirm `git status` is clean first.
- Env vars required (see `.env.example` for the full list) — must be set on whichever
  Railway service is currently live; they do NOT carry over automatically to new services.

## Git history notes

- Early commits accidentally included `node_modules` (a 100MB+ file blocked the push).
  Repo was fully deleted and recreated clean with a proper `.gitignore`
  (`node_modules/`, `.next/`, `.env`) from the first commit. Don't remove `.gitignore`.
- `next` was bumped from `14.2.15` → `14.2.35` to clear CVE-2025-55184/CVE-2025-67779,
  which Railway's build scanner blocks on. Don't downgrade.

## Open TODOs

- [x] Deploy on Railway and set up the `/check-in` Webflow iframe embed — live
- [x] Confirm the `frame-ancestors` origins in `next.config.js` — verified live
- [ ] Confirm the four Walk-in Leads select fields (`Got Agent?`, `What Brings You Here?`,
      `Timeline`, `Need to Sell First?`) have option strings in Lark that exactly match
      the constants in `src/lib/types.ts` — a mismatch throws on submit, not silently.
      `npm run check-field` (`scripts/check-select-fields.js`) does this but needs a
      local `.env` with real credentials, which no one has run yet.
- [ ] Delete dead Railway services (v1–v4) once v5 is confirmed stable
- [ ] Decide on NRIC handling — full capture vs. last-4-digits vs. Advanced Permission
      restriction (see gotcha #6 above)
- [ ] The old Webflow "PropertyGiant Open House Registration" form still exists on the
      `/check-in` page inside a hidden `<div class="hide">`. It's not reachable, but it
      should be deleted outright so it can't be un-hidden and start capturing leads in
      parallel with `/check-in`.
- [ ] `ANTHROPIC_API_KEY` is in `.env.example` but is NOT set on Railway, so the AI summary
      in `src/app/api/reports/route.ts` silently no-ops (`if (!process.env...) return`) and
      the Weekly Report "AI Summary" field is never written. Either set the key or drop it
      from `.env.example` — right now it reads as broken config rather than a choice.
      That code path has never run in production; it also pins `claude-sonnet-4-6`, which
      is a generation behind and should be revisited before first real use.
- [ ] Optional: `workers/propertygiant-proxy.js` is a Cloudflare Worker that would serve
      `/check-in` from propertygiant.com same-origin, replacing the iframe entirely.
      propertygiant.com already resolves through Cloudflare with Webflow as the origin, so
      only dashboard access is needed to deploy it. Written and committed, never deployed.