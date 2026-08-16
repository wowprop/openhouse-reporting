# PropertyGiant Open House Reporting

Internal tool for the open house team, built against your actual Lark Base schema:

- **Properties** — ongoing open house listings
- **Weekly Report** — linked to a Property; submitted via `/report`
- **Buyer References** — linked to a Weekly Report (multiple per report)
- **Walk-in Leads** — captured from Webflow form submissions, viewable at `/leads`
- **Agents** — your team roster, linked from Walk-in Leads

## ⚠️ Action needed on the Base before this works

A few fields the code expects don't exist yet in your tables, or have naming that needs
your confirmation:

1. **Weekly Report table**: rename "Repord ID" → "Report ID" (typo, cosmetic only,
   doesn't block anything).
2. **Weekly Report table**: add an **"AI Summary"** field (Long text) if you want the
   optional AI summary write-back feature. Without it, that feature silently no-ops.
3. **Buyer References table**: confirm the Follow Up Status single-select options are
   exactly: `Not Started`, `In Progress`, `Follow-up Done`, `Not Interested`, `Converted`
   — the code sends these exact strings.
4. **Walk-in Leads / NRIC**: this field holds sensitive PDPA-regulated data. Before
   going live, decide: (a) do you actually need full NRIC captured on a public-facing
   form at all, or (b) if yes, restrict the field's visibility via Lark's Advanced
   Permission so only compliance-handling staff can see it. The `/leads` table view in
   this app already excludes NRIC from display as a safety default — but the field is
   still written to Lark as plaintext, so the Base-level restriction is still worth doing.
5. **Property / Served By linking on Webflow leads**: these are Link fields pointing to
   Properties/Agents. A raw Webflow text submission (e.g. an address) can't be written
   directly into a Link field — see the comment in
   `src/app/api/leads/webhook/route.ts` for how this is currently handled (folded into
   Specific Requirements, linked manually afterward) and a note on a smarter auto-match
   approach if you want it built later.

## Local setup

```bash
cp .env.example .env
# fill in LARK_APP_ID / LARK_APP_SECRET from your Developer Console
# LARK_BASE_APP_TOKEN and all LARK_TABLE_* values are already filled in from your Base
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Deploy on Railway

1. Push to a GitHub repo (e.g. under `wowprop`).
2. Railway → New Project → Deploy from GitHub repo.
3. Set the same environment variables from `.env` in Railway's Variables tab.
4. Point `report.propertygiant.com` at it via CNAME (Railway → Settings → Networking →
   Custom Domain gives you the target).

## Wire up Webflow → Walk-in Leads

Webflow → Site Settings → Integrations → Webhooks → Add Webhook:
- Trigger: `Form Submission`
- URL: `https://report.propertygiant.com/api/leads/webhook`

Update `WEBFLOW_FIELD_MAP` in `src/app/api/leads/webhook/route.ts` — the left-hand keys
are placeholders and need to match your actual Webflow field `name` attributes.

Recommended: route through Make.com/n8n instead of direct, so you have a place to add
AI lead classification or Property/Agent auto-matching before the record hits Lark.

## AI weekly-summary (optional)

Set `ANTHROPIC_API_KEY` in Railway. Requires the "AI Summary" field to exist on Weekly
Report (see action item #2 above).

## File map

```
src/
  app/
    page.tsx                     → home page
    report/page.tsx              → weekly report form (Property dropdown + dynamic buyer refs)
    leads/page.tsx                → Walk-in Leads table view (NRIC excluded from display)
    api/
      reports/route.ts            → POST: writes Weekly Report + Buyer References, triggers AI summary
      properties/route.ts         → GET: lists Properties for the form dropdown
      agents/route.ts             → GET: lists Agents (available for future use, e.g. Served By assignment UI)
      leads/route.ts               → GET: fetches Walk-in Leads for the table view
      leads/webhook/route.ts       → POST: receives Webflow form webhook, writes to Walk-in Leads
  lib/
    lark.ts                       → Lark Base API client (auth, create/update/list records)
    types.ts                      → shared types + date formatting
```

## Base reference

```
app_token: WgVRbO0pSa1WQys2dVLlHyQJgog
Properties:        tbly12QHaVv2cqdR
Weekly Report:      tble1S4vzSTI4BPy
Buyer References:  tblxv34BmZ6YaMkQ
Walk-in Leads:      tblqDTrCP4R5wEV8
Agents:             tblWqZbUbKbcmVzI
```
