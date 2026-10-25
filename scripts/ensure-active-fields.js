#!/usr/bin/env node
/**
 * One-time Lark schema migration: adds an "Active" checkbox to Properties and Agents.
 *
 * - If "Active" does not exist, creates it (Lark type 7 = checkbox).
 * - When it creates the field, it ticks Active on every existing record, so the current
 *   listings/agents keep appearing after the app starts filtering. New rows created later
 *   start unchecked and stay hidden until someone ticks them.
 * - If the field already exists, values are left alone. `--backfill` forces every row true
 *   (use with care: it also re-activates rows someone deliberately unticked).
 *
 * Usage:
 *   npm run ensure-active-fields
 *   npm run ensure-active-fields -- --dry-run
 *   npm run ensure-active-fields -- --backfill
 *
 * Needs the same env vars as the app (see .env.example). Loads a .env file from the
 * project root if present, but never prints any secret.
 */

const fs = require("fs");
const path = require("path");

function loadDotEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = (match[2] || "").trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const LARK_DOMAIN = process.env.LARK_DOMAIN || "https://open.larksuite.com";
const APP_ID = process.env.LARK_APP_ID;
const APP_SECRET = process.env.LARK_APP_SECRET;
const BASE_APP_TOKEN = process.env.LARK_BASE_APP_TOKEN;

const ACTIVE = "Active";
const CHECKBOX_TYPE = 7;
const BATCH_SIZE = 500;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const FORCE_BACKFILL = args.has("--backfill");

const TABLES = [
  { label: "Properties", id: process.env.LARK_TABLE_PROPERTIES },
  { label: "Agents", id: process.env.LARK_TABLE_AGENTS },
];

let token = "";

async function larkApi(apiPath, init = {}) {
  const res = await fetch(`${LARK_DOMAIN}${apiPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Lark API error at ${apiPath}: ${data.msg} (code ${data.code})`);
  }
  return data.data;
}

async function authenticate() {
  const res = await fetch(`${LARK_DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Lark auth failed: ${data.msg} (code ${data.code})`);
  }
  token = data.tenant_access_token;
}

async function listFields(tableId) {
  const fields = [];
  let pageToken;

  do {
    const qs = new URLSearchParams({ page_size: "100" });
    if (pageToken) qs.set("page_token", pageToken);
    const data = await larkApi(
      `/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/fields?${qs}`
    );
    fields.push(...(data.items || []));
    pageToken = data.has_more ? data.page_token : undefined;
  } while (pageToken);

  return fields;
}

async function listAllRecords(tableId) {
  const records = [];
  let pageToken;

  do {
    const qs = new URLSearchParams({ page_size: "500" });
    if (pageToken) qs.set("page_token", pageToken);
    const data = await larkApi(
      `/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/records?${qs}`
    );
    records.push(...(data.items || []));
    pageToken = data.has_more ? data.page_token : undefined;
  } while (pageToken);

  return records;
}

async function createActiveField(tableId) {
  await larkApi(`/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/fields`, {
    method: "POST",
    body: JSON.stringify({ field_name: ACTIVE, type: CHECKBOX_TYPE }),
  });
}

async function setActive(tableId, recordIds) {
  for (let i = 0; i < recordIds.length; i += BATCH_SIZE) {
    const chunk = recordIds.slice(i, i + BATCH_SIZE);
    await larkApi(
      `/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/records/batch_update`,
      {
        method: "POST",
        body: JSON.stringify({
          records: chunk.map((recordId) => ({
            record_id: recordId,
            fields: { [ACTIVE]: true },
          })),
        }),
      }
    );
  }
}

function isActive(record) {
  return record.fields && record.fields[ACTIVE] === true;
}

async function main() {
  if (!APP_ID || !APP_SECRET || !BASE_APP_TOKEN) {
    console.error(
      "Missing one of LARK_APP_ID / LARK_APP_SECRET / LARK_BASE_APP_TOKEN.\n" +
        "Set them in your shell, or put a .env in the project root (see .env.example)."
    );
    process.exit(1);
  }

  const missingTable = TABLES.find((table) => !table.id);
  if (missingTable) {
    console.error(
      `Missing LARK_TABLE_${missingTable.label.toUpperCase()} (needed for ${missingTable.label}).`
    );
    process.exit(1);
  }

  console.log(DRY_RUN ? "Dry run — no changes will be written.\n" : "Applying Active fields…\n");
  await authenticate();

  for (const table of TABLES) {
    console.log(`${table.label}`);
    const fields = await listFields(table.id);
    const exists = fields.some((field) => field.field_name === ACTIVE);
    const fieldMissing = !exists;
    let created = false;

    if (exists) {
      console.log(`  • "${ACTIVE}" already exists`);
    } else if (DRY_RUN) {
      console.log(`  • would create "${ACTIVE}" (checkbox)`);
    } else {
      await createActiveField(table.id);
      created = true;
      console.log(`  ✓ created "${ACTIVE}" (checkbox)`);
    }

    const records = await listAllRecords(table.id);
    const notActive = records.filter((record) => !isActive(record));

    // A real run backfills right after creating the field. A dry run reports the same
    // backfill even though nothing was created. An existing field is only touched when
    // --backfill is passed, so a deliberate un-tick is never silently undone.
    const willBackfill = created || (DRY_RUN && fieldMissing) || FORCE_BACKFILL;

    if (!willBackfill) {
      console.log(
        `  • ${records.length} record(s), ${notActive.length} not Active — left unchanged`
      );
      if (notActive.length > 0) {
        console.log("    (run with --backfill to tick every existing record)");
      }
      continue;
    }

    if (notActive.length === 0) {
      console.log(`  • all ${records.length} record(s) already Active`);
    } else if (DRY_RUN) {
      console.log(`  • would set Active=true on ${notActive.length} record(s)`);
    } else {
      await setActive(
        table.id,
        notActive.map((record) => record.record_id)
      );
      console.log(`  ✓ set Active=true on ${notActive.length} record(s)`);
    }
  }

  console.log(
    DRY_RUN
      ? "\nDry run complete. Re-run without --dry-run to apply."
      : "\nDone. Only ticked rows now appear in the /check-in and /report dropdowns."
  );
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
