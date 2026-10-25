import { hasField } from "./lark";

/**
 * The checkbox that decides whether a Property or Agent appears in the app's pickers
 * (/check-in and /report). Only an explicit `true` counts as active.
 *
 * Fail open when the field has not been added to the Lark table yet: a code deploy that
 * lands before the schema migration must not empty the dropdowns and block check-ins.
 * The warning is logged once per table per process so it does not flood the logs.
 *
 * Historical data is deliberately NOT filtered by this helper. An inactive property or
 * agent still appears on past leads/reports, which is what "inactive" should mean.
 */
export const ACTIVE_FIELD = "Active";

const warnedTables = new Set<string>();

export async function filterActive<T extends { fields: Record<string, unknown> }>(
  tableId: string,
  items: T[]
): Promise<T[]> {
  if (!(await hasField(tableId, ACTIVE_FIELD))) {
    if (!warnedTables.has(tableId)) {
      warnedTables.add(tableId);
      console.warn(
        `Lark table ${tableId} has no "${ACTIVE_FIELD}" field — returning all records. ` +
          `Add the checkbox and run \`npm run ensure-active-fields\` to enable filtering.`
      );
    }
    return items;
  }

  return items.filter((item) => item.fields[ACTIVE_FIELD] === true);
}
