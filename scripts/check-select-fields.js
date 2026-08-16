/**
 * Fetches the live option strings for the Walk-in Leads select fields from Lark and
 * diffs them against the constants in src/lib/types.ts, so a Lark-side rename doesn't
 * silently break /check-in submissions (Lark rejects an option string it doesn't have).
 *
 * Usage: node scripts/check-select-fields.js
 * Reads the same vars as .env.example — either export them in your shell first, or
 * this will load a .env file in the project root if present.
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
const LEADS_TABLE_ID = process.env.LARK_TABLE_WALKIN_LEADS;

// Keep in sync with src/lib/types.ts — this script intentionally duplicates rather
// than importing, since it needs to run standalone with plain `node`.
const EXPECTED = {
  "Got Agent?": ["Yes", "No"],
  "What Brings You Here?": [
    "Looking to Buy a Landed Property",
    "Exploring / Just Looking Around",
    "Looking on Behalf of Family / Someone Else",
    "Other",
  ],
  Timeline: [
    "Ready to buy / Actively looking",
    "Within 3 Months",
    "Within 6 Months",
    "Just Exploring for Now",
  ],
  "Need to Sell First?": ["Yes", "No", "Not Sure / Would Like Advice"],
};

async function main() {
  if (!APP_ID || !APP_SECRET || !BASE_APP_TOKEN || !LEADS_TABLE_ID) {
    console.error(
      "Missing one of LARK_APP_ID / LARK_APP_SECRET / LARK_BASE_APP_TOKEN / LARK_TABLE_WALKIN_LEADS.\n" +
        "Set them in your shell, or put a .env in the project root (see .env.example)."
    );
    process.exit(1);
  }

  const tokenRes = await fetch(`${LARK_DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.code !== 0) {
    console.error(`Lark auth failed: ${tokenData.msg} (code ${tokenData.code})`);
    process.exit(1);
  }
  const token = tokenData.tenant_access_token;

  const fieldsRes = await fetch(
    `${LARK_DOMAIN}/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${LEADS_TABLE_ID}/fields?page_size=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const fieldsData = await fieldsRes.json();
  if (fieldsData.code !== 0) {
    console.error(`Failed to list fields: ${fieldsData.msg} (code ${fieldsData.code})`);
    process.exit(1);
  }

  const fieldsByName = Object.fromEntries(
    fieldsData.data.items.map((f) => [f.field_name, f])
  );

  let anyMismatch = false;

  for (const [fieldName, expectedOptions] of Object.entries(EXPECTED)) {
    console.log(`\n${fieldName}`);
    const field = fieldsByName[fieldName];
    if (!field) {
      console.log(`  ✗ Field not found in Lark at all (checked exact name "${fieldName}")`);
      anyMismatch = true;
      continue;
    }
    const liveOptions = (field.property?.options || []).map((o) => o.name);
    console.log(`  Lark:     ${JSON.stringify(liveOptions)}`);
    console.log(`  types.ts: ${JSON.stringify(expectedOptions)}`);

    const missingInLark = expectedOptions.filter((o) => !liveOptions.includes(o));
    const missingInCode = liveOptions.filter((o) => !expectedOptions.includes(o));

    if (missingInLark.length || missingInCode.length) {
      anyMismatch = true;
      if (missingInLark.length)
        console.log(`  ✗ In types.ts but not in Lark: ${JSON.stringify(missingInLark)}`);
      if (missingInCode.length)
        console.log(`  ⚠ In Lark but not in types.ts: ${JSON.stringify(missingInCode)}`);
    } else {
      console.log("  ✓ match");
    }
  }

  console.log(anyMismatch ? "\nMismatches found — fix before deploying /check-in." : "\nAll good.");
  process.exit(anyMismatch ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
