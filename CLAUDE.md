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

- `propertygiant.com/check-in` → iframes this app's `/check-in`
- `propertygiant.com/openhouse-report` → iframes this app's `/report` (internal team,
  `/leads` reachable from there via the internal `Nav`)

`next.config.js` sets a `Content-Security-Policy: frame-ancestors` header explicitly
allowing those origins to iframe this app. If the embedding domain ever changes, update
that header or the iframe will render blank.

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

## Deployment (Railway)

- Repo: `wowprop/openhouse-reporting` on GitHub, `main` branch
- Currently live service: **openhouse-reporting-v5** (Railway auto-names new services;
  history of dead services from earlier debugging — v1 through v4 — should be deleted
  from the Railway dashboard if not already done)
- Auto-deploy on push to `main` is NOT reliably configured — if a push doesn't trigger a
  new build within ~30s, trigger manually via Railway's redeploy/create-deployment.
- **`redeploy` reuses the last build snapshot — it does NOT pull fresh from GitHub.**
  If you need to deploy new commits, use a fresh deployment trigger pointed at the repo,
  not a plain redeploy.
- Env vars required (see `.env.example` for the full list) — must be set on whichever
  Railway service is currently live; they do NOT carry over automatically to new services.

## Git history notes

- Early commits accidentally included `node_modules` (a 100MB+ file blocked the push).
  Repo was fully deleted and recreated clean with a proper `.gitignore`
  (`node_modules/`, `.next/`, `.env`) from the first commit. Don't remove `.gitignore`.
- `next` was bumped from `14.2.15` → `14.2.35` to clear CVE-2025-55184/CVE-2025-67779,
  which Railway's build scanner blocks on. Don't downgrade.

## Open TODOs

- [ ] Deploy this app on Railway under a stable URL, then set up the two Webflow iframe
      embeds (`propertygiant.com/check-in` and `propertygiant.com/openhouse-report`)
      pointed at `/check-in` and `/report` respectively
- [ ] Confirm the `Content-Security-Policy: frame-ancestors` origins in `next.config.js`
      match the real Webflow embedding domain (`www.propertygiant.com` vs bare domain,
      any staging domain) — the iframe renders blank if this is wrong
- [ ] Confirm the four Walk-in Leads select fields (`Got Agent?`, `What Brings You Here?`,
      `Timeline`, `Need to Sell First?`) have option strings in Lark that exactly match
      the constants in `src/lib/types.ts` — a mismatch throws on submit, not silently
- [ ] Delete dead Railway services (v1–v4) once v5 is confirmed stable
- [ ] Decide on NRIC handling — full capture vs. last-4-digits vs. Advanced Permission
      restriction (see gotcha #6 above)
- [ ] The old Webflow "PropertyGiant Open House Registration" form + its webhook are
      superseded by `/check-in` — once the iframe embed is live, remove/disable the old
      Webflow form so leads aren't captured in two places