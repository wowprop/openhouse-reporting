# Open House Reporting — Webstudio migration + per-agent lead access

Status: **plan + partial implementation** (Active checkbox done 2026-10-25; auth still planned) · 2026-10-20
Scope: the `/openhouse-report` experience (`/report`, `/leads`) and the public `/check-in` page.
Related: `CLAUDE.md`, `../wiki/architecture.md`, `../wiki/systems/openhouse-reporting.md`,
`../public-website/CLAUDE.md`.

> **Update 2026-10-25:** the `Active` checkbox is implemented for **both Properties and
> Agents**, and the live Lark columns are created (6 Properties, 20 Agents backfilled).
> `/api/properties` and `/api/agents` now return ticked rows only (they fail open and log a
> warning until the Lark field exists), and `npm run ensure-active-fields` creates the field
> and backfills existing rows. The agent-login part below is still a plan.

---

## 1. TL;DR — the recommendation

**Do not rebuild the authenticated leads table as a native Webstudio page in v1.**
Webstudio can render a form response, but it has no visitor session, cannot read cookies in a
Resource, and a managed Form's HTTP action runs server-to-server (so it cannot set a login
cookie). That means a native Webstudio leads page can only work as "enter email + password,
see a one-off snapshot" — it cannot keep the 15-second live refresh the current `/leads` page
has, and the agent must re-enter the password on every visit.

Recommended target:

1. **Add real agent auth to the existing Next.js app** (Lark is the credential store) and scope
   `/api/leads` server-side to `Served By = logged-in agent`. Keep the live polling table there.
2. **Rebuild the public pages natively in Webstudio**:
   - `/check-in` → a native Webstudio Form posting to the existing `/api/checkin`.
   - `/openhouse-report` → a Webstudio entry page with the native agent login form, posting
     directly to the Next app's login endpoint (a real browser form, so the cookie is set).
3. **Serve the authenticated portal at `report.propertygiant.com`** (the domain already
   anticipated in `next.config.js`) as a top-level page, not an iframe. If it must live under
   `propertygiant.com/openhouse-report`, proxy it same-origin with the already-written
   `workers/propertygiant-proxy.js` (see §9).
4. Optionally, in a later phase, port the login/leads *presentation* into Webstudio using a
   small client-side data widget if the team wants one visual system. That is a UI port, not a
   data migration.

This removes Webflow and both iframes, gives each agent a real login with server-enforced
scoping, and keeps the live behaviour and Lark integration that already work.

If the requirement is specifically "the leads table must be a Webstudio page", §8 has the two
fully-native patterns and their trade-offs. Read §3 first — the constraint is not obvious.

---

## 2. What exists today

| Route | Behaviour | Auth today |
|---|---|---|
| `/check-in` | Public visitor registration, writes directly to Lark `Walk-in Leads`, Telegram alert. Iframed by `propertygiant.com/check-in`. | None (public by design) |
| `/` | Open house team landing: links to Report and Leads. Iframed by `propertygiant.com/openhouse-report`, whose Webflow page password-protects it. | Webflow page password only |
| `/report` | Weekly report + dynamic buyer-reference rows. | None on the Railway URL |
| `/leads` | Live polling table (15s + focus), property/agent filters, expandable rows, NRIC excluded. | None on the Railway URL |
| `/api/*` | Lark reads/writes. | None |

Key facts:

- **Lark Base is the source of truth.** No Supabase code in this repo.
- The app is a persistent Next.js 14 service on Railway (`openhouse-reporting-v5`).
- The current `/leads` page exposes lead PII (name, contact) to anyone with the Railway URL.
  The only gate is the Webflow page password around the iframe.
- `workers/propertygiant-proxy.js` deliberately does **not** proxy `/report` or `/leads`,
  with the comment "Add auth first." That is the correct order.
- `Agents` (`tblWqZbUbKbcmVzI`) already exists and is linked from `Walk-in Leads` as
  `Served By`. That link is the natural scoping key — no new identity model is needed.

---

## 3. The Webstudio constraint that drives the design

Verified against the current Webstudio docs (2026-10):

| Capability | Reality |
|---|---|
| Resources | Fetched server-side by Webstudio/Cloudflare. Secrets are safe, but there is **no visitor cookie/session binding** available to a Resource. |
| Managed Form → HTTP Resource | The POST is made **server-to-server** by Webstudio. The target's `Set-Cookie` never reaches the browser, so it cannot start a login session. |
| Form response | A Form exposes `results` (status + body) and `errors`; the success state can bind and render the response. This works for a one-off "login → see data" flow. |
| Native HTML form | An `Element` with tag `form` can post directly from the browser (and can receive a cookie), but then Webstudio cannot use that cookie to load a Resource. |
| Built-in authentication | HTTP Basic Auth per page or per route pattern — **one shared login/password**, not per-user accounts, and no way to pass the user identity into a Resource. |
| Dynamic options | `Select` supports `Collection` over a Resource, so Property/Agent dropdowns are fine. |
| Client-side code | `HtmlEmbed` with `clientOnly` can run arbitrary JS and call an API with `fetch`. This is the escape hatch for a persistent, scoped UI. |

Consequences:

- You cannot have all three of: **native Webstudio page + persistent login + server-scoped
  data**. Pick two.
- If the credential is sent per request, Webstudio can render the response — but there is no
  session, no live polling, and no way to pass the identity into a second form.
- If the UI is client-side, it can keep a token/session and poll, but it is a JS widget inside
  Webstudio, not native Webstudio components.

---

## 4. Options

| | A. Hybrid (recommended) | B. Native, per-request login | C. Native shell + client widget | D. Move data to Supabase |
|---|---|---|---|---|
| Webstudio builds | `/check-in`, `/openhouse-report` entry/login | everything, including leads | everything visually; table is JS | everything |
| Persistent login | Yes (cookie in Next app) | No — password each visit | Yes (token in memory/sessionStorage) | Yes (Supabase Auth) |
| Live 15s polling | Yes | No | Yes | Yes |
| Server-enforced scoping | Yes | Yes | Yes | Yes (RLS) |
| Lark stays source of truth | Yes | Yes | Yes | No — sync/migrate |
| Effort | ~4–6 days | ~5–8 days | ~8–12 days | ~3–4 weeks + migration risk |
| Ongoing complexity | Two codebases, one visual boundary | One stack, poor UX | One stack, JS widget to maintain | New DB/auth/sync |

**Choose A** unless there is a hard requirement that no page of the flow may be served by the
Next app. B is acceptable only if the table is read-on-demand, not live. C is the only fully
native + persistent + live option, and it is a custom app wearing a Webstudio page.

D is not recommended: Lark is the affiliate-facing source of truth, the public site's Supabase
is shared with GiantOS, and a two-way sync would be a much larger project than this feature.

---

## 5. Recommended architecture (Option A)

```
propertygiant.com
  /check-in            Webstudio page (native Form)  ──POST──▶  report.propertygiant.com/api/checkin
  /openhouse-report    Webstudio entry + login form  ──POST──▶  report.propertygiant.com/api/auth/login
                                                                  │  Set-Cookie (first-party on report.*)
                                                                  ▼
                                                        report.propertygiant.com
                                                          /login  / (session redirect)
                                                          /report /leads   (auth required)
                                                                  │
                                                                  ▼
                                                        Lark Base (Agents, Leads, Reports)
```

- The Webstudio pages are public shells; they contain no lead data and no secrets.
- The login form is a **native HTML form** (`Element` tag `form`), not a managed Webstudio Form,
  because only a browser-submitted form can receive the `Set-Cookie` response.
- The app's `report.*` pages are top-level navigations, not iframes. Do **not** iframe the
  authenticated pages: third-party cookie blocking would break the session.
- The cookie is host-only for `report.propertygiant.com`, `HttpOnly`, `Secure`,
  `SameSite=Lax`, `Path=/`, 12h lifetime.
- `report.propertygiant.com` must be a real custom domain on the Railway service before the
  login form ships. Posting passwords to a `*.up.railway.app` URL is not acceptable for agents.

### Why not keep the iframe?

An iframe of `report.propertygiant.com` on `propertygiant.com` makes the session cookie
third-party. Safari and Chrome increasingly block those, and the failure mode is a login loop
that is very hard to debug. Remove the iframe as part of this work.

---

## 6. Agent authentication design

### 6.1 Lark schema changes (Agents table)

`Properties` also carries the `Active` checkbox (already implemented — see CLAUDE.md
gotcha #9). The picker routes filter on it, so adding an agent does not need a separate
property-side change.

Add to `Agents` (`tblWqZbUbKbcmVzI`). Exact field names matter — verify against the live table
before coding (gotcha #4).

| Field | Lark type | Purpose |
|---|---|---|
| `Email` | Text | Login identifier. Stored lowercase, trimmed. |
| `Password Hash` | Text (multi-line) | Versioned scrypt hash. **Never** returned by any API. |
| `Active` | Checkbox | Inactive agents cannot log in and are hidden from check-in dropdowns. |
| `Is Admin` | Checkbox | Sees all leads; can set passwords. Default off. |
| `Password Updated At` | Date | For onboarding/audit; optional. |
| `Last Login At` | Date | Optional, cheap audit trail. |

Do **not** store plaintext passwords, even though the request said "store the agents' password
in Lark". Store a hash. If someone with the Lark app secret can read the Base, a plaintext
password compromises the agent's other accounts too; a scrypt hash does not.

Optional (only if the weekly report should be scoped as well): add `Agent` (Link → Agents) to
`Weekly Report`. Today `Submitted By` is free text, which is not a reliable identity key. For
v1, keep report submission gated but attribute it from the session; the link field can come
later when "my reports" is needed.

### 6.2 Password storage

- Algorithm: Node `crypto.scrypt` (no new dependency), `N=16384, r=8, p=1`, 16-byte random salt,
  64-byte key.
- Stored format: `scrypt$16384$8$1$<salt-base64>$<hash-base64>` (versioned so parameters can
  change later).
- Verify with `crypto.timingSafeEqual`; always run a dummy verification when the email is
  unknown so response timing does not reveal which emails exist.
- Policy: minimum 10 characters, maximum 128, no composition rules (NIST-style). Generated
  temporary passwords should be 16+ random characters.
- Hash generation happens server-side only. A local admin script (or later an admin-only page)
  writes the hash to Lark. Never hash in the browser and never log the plaintext.

### 6.3 Login flow

1. `POST /api/auth/login` with `email` + `password` (JSON from the app login page, or
   `application/x-www-form-urlencoded` from the Webstudio native form).
2. Normalize email, load the Agents table (paginated), find the matching `Email`.
3. Reject if missing, `Active` is false, or no `Password Hash`.
4. Verify scrypt hash. On failure: generic `Invalid email or password`, 401, rate-limit counter.
5. On success: sign a JWT (`jose`, HS256, `AUTH_SECRET`), set the session cookie, update
   `Last Login At` best-effort, and:
   - JSON request → `{ ok: true, agent: { name, isAdmin } }`
   - form request → `303` to a validated relative `next` (default `/leads`)
6. The Webstudio form posts `next=/leads` and `returnTo=https://propertygiant.com/openhouse-report`
   (hidden fields). On failure the app redirects back to `returnTo` with `?error=1`; the page
   shows a generic error via a Show condition on `system.search.error`. `returnTo` must be
   checked against an explicit allowlist, not used as an open redirect.
7. `POST /api/auth/logout` clears the cookie and redirects to `/login` (or the Webstudio entry
   page).

### 6.4 Session

- JWT claims: `sub` (Agents `record_id`), `name`, `admin`, `iat`, `exp` (12h), `jti`.
- Cookie name `oh_session`; `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`.
- `AUTH_SECRET` (32+ random bytes) added to `.env.example` and Railway. Rotating it logs
  everyone out — acceptable.
- No server-side session table in v1. A password change should invalidate old sessions: either
  keep sessions short (12h) or add a `sessionVersion`/`Password Updated At` claim checked on
  login-sensitive routes. Start with short expiry + logout everywhere on password reset.
- Middleware protects page routes; route handlers verify independently. Never rely on the
  middleware alone for `/api/*`.

### 6.5 Authorization / scoping (the important part)

- The only scoping key is the `Served By` link field on `Walk-in Leads`.
- Add a helper `linkedRecordIds(value)` that reads the Lark link shape
  (`[{ record_ids: [...] }]`) — do not compare display text.
- `GET /api/leads`:
  - Requires a valid session.
  - Non-admin: `leads.filter(l => linkedRecordIds(l.fields["Served By"]).includes(session.sub))`.
  - Admin: all leads; optional `?agent=<recordId>` filter.
  - Ignore any client-supplied agent id for non-admins (or return 403 — do not silently widen).
  - Paginate all Lark pages; the current endpoint only reads the first 100 and has no paging.
  - `Cache-Control: private, no-store`, `Vary: Cookie`.
- `POST /api/reports`:
  - Requires a session.
  - Derive `Submitted By` from the session; ignore the client field.
  - If the optional `Agent` link field exists, write `[session.sub]` too.
- `/api/agents` and `/api/properties` stay public for the check-in form. `/api/agents` must
  continue to return **only** `{ recordId, name }` — never email, hash, or admin flags. Filter
  to `Active` agents (also fixes the current check-in dropdown showing former agents).
- Check-in remains public; add consent validation, a honeypot, and rate limiting (see §6.7).

### 6.6 Admin / password management

- An `Is Admin` agent sees all leads; the leads page shows the `Served By` filter for admins
  only.
- v1: a local script `npm run set-agent-password -- --email <email>` (Node, reads `.env`,
  prompts for the password, writes the scrypt hash to Lark). `--admin` and `--name` flags help
  onboarding. This keeps the first release small and avoids building an admin UI.
- v2 (optional): `/admin/agents` page, admin-only, to create/reset agents. It must never
  display existing hashes, only "set new password".
- Password reset is admin-mediated because there is no outbound email infrastructure. Document
  that. (Telegram is available but not appropriate for passwords.)
- Agents should be told to use a unique password; the login form supports password-manager
  autofill (`autocomplete="username"` / `current-password`).

### 6.7 Security controls

- Rate limit login by IP + email: 5 failures / 15 min, then 429 with `Retry-After`. Railway is a
  single persistent service, so an in-memory map is acceptable for v1; note that it resets on
  deploy. If this ever runs multi-instance, move the counter to Lark/Redis.
- Generic 401 for both unknown email and wrong password.
- Constant-time hash comparison and a dummy hash for unknown emails.
- Origin check on state-changing POSTs; `SameSite=Lax` handles the common CSRF case.
- Open-redirect guard on `next`: must start with `/` and not `//`.
- No passwords, hashes, or session tokens in logs, analytics, or error messages.
- `Cache-Control: private, no-store` on authenticated responses; `noindex` on internal pages.
- Lark `Advanced Permission` can hide `Password Hash` from human collaborators, but the API
  token bypasses UI permissions — hashing is still required.
- PDPA: agents see only their own leads; NRIC stays out of the UI; keep `Contact` visible
  because the agent needs it to follow up. Log access only if the team wants an audit trail.

### 6.8 API summary

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | public | JSON or form-encoded; sets cookie |
| POST | `/api/auth/logout` | session | clears cookie |
| GET | `/api/auth/me` | session | `{ agent, isAdmin }` |
| GET | `/api/leads` | session | scoped; paginated; no-store |
| POST | `/api/reports` | session | `Submitted By` from session |
| POST | `/api/checkin` | public | unchanged contract + consent/honeypot |
| GET | `/api/agents` | public | active agents, name + recordId only |
| GET | `/api/properties` | public | unchanged |

---

## 7. Webstudio build plan

Use the existing project (`propertygiant-draft`, `83f020f0-…`) and the existing patterns in
`../public-website/CLAUDE.md`. Do not re-run any `scripts/build_*page*.py` generator; make
focused edits via MCP. Create a restore point before structural work.

### 7.1 Shared design

- Reuse the site's existing tokens: `pg-au-eyebrow`, `pg-au-h2`, `pg-au-lead`, `pg-au-card`,
  `pg-au-btn`, `pg-au-btn-gold`, `pg-lb-hero`.
- Internal pages get a **minimal portal header** (logo + "Agent sign in"), not the public
  Navbar/Quick Links/Footer. These pages are a tool, not marketing pages.
- Background `#F7F4EE`, text `#221F1C`, gold `#B8935F` to match the current app's palette.
- Breakpoints: reuse the project's 991 / 767 / 599 / 479. No new `@media` widths.
- Every internal page: Page Settings → **Exclude from search**, and no sitemap entry.
- Accessibility: real `<label for>`, visible focus, 16px+ mobile inputs (prevents iOS zoom),
  error text tied to the form, no color-only status.

### 7.2 `/check-in` (public, native)

This is the low-risk win and can ship first.

- Page path `/check-in`; cream background, centered card max-width ~640px, logo.
- Resources:
  - `properties` = GET `https://report.propertygiant.com/api/properties`, cache 60s.
  - `agents` = GET `https://report.propertygiant.com/api/agents`, cache 60s.
- Form (managed Webstudio Form is fine; no cookie needed):
  - HTTP action POST `https://report.propertygiant.com/api/checkin`, JSON.
  - Inputs named exactly: `name`, `contact`, `propertyRecordId`, `agentRecordId`, `gotAgent`,
    `whatBrings`, `timeline`, `needToSellFirst`, `specificRequirements`, `nric`, `consent`.
  - Property and Agent are `Select` → `Collection` over the resources → `Option`
    (`value = recordId`, label = address/name). This is supported.
  - Radio groups: static options from `src/lib/types.ts`; keep the exact strings.
  - Consent checkbox required; add a hidden honeypot field (e.g. `company`) and reject if
    filled.
  - Success state: "You're checked in" + "Register another visitor" resets the form.
  - Error state: "Something went wrong. Please notify staff at the entrance."
- API hardening: validate `consent === true`, trim strings, cap lengths, rate limit by IP,
  keep the Telegram notification best-effort.
- Remove the iframe and the `FrameHeightReporter` path for this page once live. Keep the
  reporter only if another iframe remains.

### 7.3 `/openhouse-report` (entry + login)

- Page path `/openhouse-report`; `noindex`; minimal portal header.
- Hero: "Open House Team" + one sentence. Two cards:
  - **Submit Weekly Report** → `https://report.propertygiant.com/report`
  - **View Walk-in Leads** → `https://report.propertygiant.com/leads`
- Login card (the gate):
  - Use an **Element** with tag `form`, `method="post"`,
    `action="https://report.propertygiant.com/api/auth/login"`.
  - `email` (type email, `autocomplete="username"`), `password`
    (`autocomplete="current-password"`), hidden `next=/leads`, submit button.
  - Do **not** use a managed Webstudio Form here: it posts server-to-server and cannot set the
    session cookie.
  - Error: a Box shown when `system.search.error` is present, text "Invalid email or password."
  - A short "Access is managed by the open house admin" note.
- If the app is not yet on `report.propertygiant.com`, ship this page as a draft and keep the
  Webflow page live until the domain and auth are verified. Never publish a password form that
  posts to a raw Railway hostname.
- The cards can be public; clicking them without a session redirects to the app login. The
  login card is the primary path.

### 7.4 Optional: native leads page (only if §8 pattern B is chosen)

- Page path `/openhouse-report/leads`; `noindex`.
- One managed Form: email + password → POST `/api/agent/leads` → success state renders a
  Collection over `results[0].body.leads`.
- No session, no polling, no auto-refresh. Re-submitting is the refresh.
- Do not put the response in a Resource (it would be cacheable and shared); keep it in the Form
  result.
- This is a deliberate UX trade-off; do not ship it silently as a replacement for the live
  table.

---

## 8. If the leads table must itself be a Webstudio page

### Pattern B — native per-request login (no session)

- A managed Form posts email/password to a new `POST /api/agent/leads`.
- The API verifies the hash and returns only that agent's leads (no cookie, no token).
- Webstudio binds `results[0].body.leads` in a Collection inside the success state.
- Pros: fully native, no session infrastructure, no persistent token to steal, server-side
  scoping, simplest possible security model.
- Cons: password on every visit; no live polling (snapshot only); the password passes through
  Webstudio's managed-form endpoint (browser → Webstudio server → API). If that is not
  acceptable, do not use this pattern.
- Use `details`/`summary` Elements for expandable rows, or render cards instead of a table.
- This is a good fit only if agents check leads occasionally rather than watching them live.

### Pattern C — Webstudio shell + client-side widget

- Webstudio builds the page/chrome; an `HtmlEmbed` (`clientOnly`) contains a small vanilla-JS
  app that:
  - logs in against `/api/auth/login` (or `/api/agent/login`),
  - keeps a short-lived token in memory/`sessionStorage`,
  - fetches `/api/leads` with `Authorization: Bearer …`,
  - renders and polls the table.
- Requires either CORS on the API for `propertygiant.com` or a same-origin proxy (see §9).
- Pros: persistent login, live polling, one visual system.
- Cons: the table is custom JS, not Webstudio components; you now maintain a mini frontend;
  token-in-JS needs a strict CSP and no third-party scripts on that page.
- Estimate: +3–5 days over Option A.

**Recommendation:** B only for a read-on-demand report; C only if "everything on
propertygiant.com" is a hard product requirement; otherwise A.

---

## 9. Same-origin option (if the portal must live under propertygiant.com)

`workers/propertygiant-proxy.js` already proxies an allowlist of paths from
`propertygiant.com` to Railway, and rewrites redirects so the Railway hostname never appears.
It intentionally excludes `/report` and `/leads` until auth exists.

After auth ships:

1. Set Next `basePath: "/openhouse-report/app"` (or keep a subdomain and skip this).
2. Prefix client-side `fetch("/api/...")` calls with the base path (Next does not rewrite raw
   fetch URLs).
3. Add Worker routes for `/openhouse-report/app*` and the matching `_next` assets, forwarding
   `Set-Cookie` and `Location`.
4. Scope the session cookie to `Path=/openhouse-report/app`.
5. Keep the Webstudio entry page at `/openhouse-report`; the app lives below it.

This gives first-party cookies, no iframe, and one domain. It is more moving parts than the
subdomain; do it only after Option A is stable. Never proxy `/leads` without auth — the current
Worker comment is correct.

---

## 10. Phases, deliverables, estimates

| Phase | Work | Deliverable | Est. |
|---|---|---|---|
| 0 | Confirm scope (A/B/C), domain, admin role, whether reports are gated | signed-off decisions in this doc | 0.5d |
| 1 | Lark fields + password CLI + `auth.ts` (hash, JWT, cookie) | `npm run set-agent-password`, unit tests | 1–1.5d |
| 2 | Login page, middleware, logout, `/api/auth/me` | agents can sign in/out | 1d |
| 3 | Scope `/api/leads` + UI (hide agent filter for non-admins, "My leads", paging) | agent A sees only A; admin sees all | 1–1.5d |
| 4 | Gate `/report`, derive `Submitted By`; optional `Agent` link | report attribution | 0.5d |
| 5 | Test + security review (scoping, expiry, tamper, rate limit, mobile) | test notes | 1d |
| 6 | Webstudio `/check-in` native + API hardening | no iframe for check-in | 1–2d |
| 7 | Webstudio `/openhouse-report` entry + native login form | gate live on propertygiant.com | 1d |
| 8 | Cutover: custom domain, publish, remove Webflow page/iframe, docs | live | 0.5–1d |
| 9 (optional) | Native portal (B or C) | one visual system | 3–5d |

Critical path: 1 → 2 → 3 → 5 → 8. Phases 6–7 can run in parallel with 3–5.

---

## 11. Test plan

**Unit**
- hash → verify round-trip; wrong password; malformed hash; timing-safe path.
- JWT sign/verify; expired; tampered signature; wrong secret.
- `linkedRecordIds()` on real Lark link payloads (array of objects, empty, text-only).
- `next` sanitizer (`/leads` ok; `//evil.com`, `https://evil.com` rejected).

**Integration / API**
- Login with valid agent → cookie set; `GET /api/leads` returns only that agent's records.
- Agent A requests `?agent=<B>` → still only A (or 403), never B.
- Admin sees all and can filter by agent.
- No cookie / expired / tampered cookie → 401 or redirect to login.
- Logout → cookie cleared; next request 401.
- 5 bad passwords → 429; correct password after cooldown works.
- `POST /api/reports` with a forged `submittedBy` → ignored, session name used.
- `/api/agents` response contains no email/hash/admin fields; inactive agents absent.
- Check-in still writes to Lark and sends Telegram; missing consent rejected.

**Manual / UX**
- Webstudio login form on mobile Safari and Chrome; password-manager autofill; error state.
- `report.propertygiant.com` cookie is first-party; no iframe; refresh keeps session.
- Leads table polling still works; property filter; admin agent filter.
- Check-in form on mobile; dynamic property/agent lists; success state; no iframe height bug.
- Screen reader labels; keyboard-only login; focus visible.
- No lead data or secrets in page source of the Webstudio entry/check-in pages.

**Regression**
- Lark token retry still works.
- Weekly report date timestamp, buyer-reference linking, select option strings.
- `npm run build` passes; `npm run check-fields` passes with a real `.env`.

---

## 12. Cutover and rollback

1. Build Webstudio pages as drafts; test on `propertygiant.wstd.io` (staging basic auth).
2. Configure `report.propertygiant.com` on Railway; verify TLS, cookie domain, redirects.
3. Deploy auth to Railway; test with 2–3 real agent accounts before touching Webflow.
4. Publish `/check-in` in Webstudio; compare against the live Webflow page; then remove the
   iframe from the Webflow page (or redirect it).
5. Publish `/openhouse-report`; point the Webflow page/nav link to it or redirect; keep the old
   page for one week.
6. Remove `FrameHeightReporter` and the `frame-ancestors` CSP only after no iframe remains.
7. Update `CLAUDE.md`, the wiki page, and `.env.example` (`AUTH_SECRET`).

Rollback: Webstudio restore point before structural work; Railway keeps the previous
deployment; the Webflow page can be restored until it is deleted. The app must remain usable at
its Railway URL for testing even after the custom domain is live.

---

## 13. Risks and open questions

| Risk | Mitigation |
|---|---|
| Webstudio cannot do per-agent sessions | Option A; do not promise a native live table |
| Third-party cookies break an iframe login | No iframe for authenticated pages |
| Lark API token bypasses field permissions | scrypt hashes; protect `LARK_APP_SECRET`; no hash in responses |
| No email infrastructure for resets | admin-mediated CLI/page; document it |
| In-memory rate limit resets on deploy | acceptable v1; note multi-instance limitation |
| Affiliate emails may be personal/absent | confirm; fallback to mobile as the identifier if needed |
| Webstudio project is still a draft; Webflow is live | do not publish early; coordinate with the site migration |
| Dynamic `+Add` buyer rows can't be native | keep report in the app for v1; fixed rows only if ported |
| Lark link-field scoping is easy to get wrong | test with real payloads; never compare display text |

Decisions needed before Phase 1:

1. **Scope:** A (recommended), B, or C?
2. **Persistent login:** required, or is per-visit unlock acceptable?
3. **Reports:** gate `/report` too, or only `/leads`?
4. **Admin:** who gets `Is Admin`, and who resets passwords?
5. **Domain:** confirm `report.propertygiant.com`, or use the same-origin proxy?
6. **Data:** confirm Lark remains the source of truth (recommended; no Supabase migration).

---

## 14. Files likely to change (Option A)

```
src/lib/auth.ts                 new — scrypt hash/verify, JWT, cookie helpers
src/lib/active.ts               new — Active-checkbox filter (fail-open until field exists)
src/lib/lark.ts                 add listAllRecords / listFields / hasField / batchUpdateRecords
src/lib/types.ts                add Agent/Session types; keep option constants
src/middleware.ts               new — protect /, /report, /leads
src/app/login/page.tsx          new — app login (email/password)
src/app/api/auth/login/route.ts new — JSON + form-encoded, sets cookie
src/app/api/auth/logout/route.ts new
src/app/api/auth/me/route.ts    new
src/app/api/leads/route.ts      scope by session; paginate; no-store
src/app/api/reports/route.ts    require session; derive Submitted By
src/app/api/checkin/route.ts    consent + honeypot + rate limit
src/app/api/properties/route.ts filter Active (done 2026-10-25)
src/app/api/agents/route.ts     filter Active; keep name-only response (done 2026-10-25)
src/app/leads/page.tsx          "My leads"; hide agent filter for non-admins
src/app/report/page.tsx         remove name input; show signed-in agent
src/components/Nav.tsx          agent name + sign out
.env.example                    add AUTH_SECRET
package.json                    add jose, ensure-active-fields script
scripts/set-agent-password.js   new — admin CLI
scripts/ensure-active-fields.js done 2026-10-25 — create/backfill the Active checkbox
docs/…                          this plan + runbook
```

Webstudio changes are made through MCP (`refresh` first), not by committing generated files:

```
new page /check-in
new page /openhouse-report
tokens reused: pg-au-*, pg-lb-hero
fragments: minimal portal header (no public Navbar/Footer)
```

---

## 15. One-page checklist

- [ ] Decide A/B/C; confirm Lark stays source of truth
- [ ] Add Lark Agents fields (`Email`, `Password Hash`, `Active`, `Is Admin`)
- [ ] Build `set-agent-password` CLI; create the first admin
- [ ] Add `/api/auth/*`, middleware, login page
- [ ] Scope `/api/leads` by `Served By`; test agent A vs B vs admin
- [ ] Gate `/report`; derive `Submitted By`
- [ ] Harden `/api/checkin` (consent, honeypot, rate limit)
- [ ] Build Webstudio `/check-in` native form
- [ ] Build Webstudio `/openhouse-report` entry + native login form
- [ ] Configure `report.propertygiant.com`; test cookies on mobile
- [ ] Publish, remove iframe, update docs/restore point
- [ ] (Optional) native portal pattern B/C
```
