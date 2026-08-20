/**
 * Telegram notifications for new walk-in registrations.
 *
 * Best-effort by design: a failure here must never surface to the visitor standing at
 * the door, and must never lose a registration that Lark already accepted. Callers
 * should treat this as fire-and-forget.
 *
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID. With either unset this no-ops, so
 * the feature can be switched off per-environment without a code change.
 *
 * TELEGRAM_TOPIC_ID is optional and targets a single topic inside a forum-enabled
 * supergroup. Topics do not exist in broadcast channels — if the destination is a real
 * channel, leave it unset. Unset also means "post to the General topic" in a forum.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TOPIC_ID = process.env.TELEGRAM_TOPIC_ID;

/** Telegram's HTML parse mode only requires these three to be escaped. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type CheckInNotification = {
  name: string;
  contact: string;
  property: string;
  agent: string;
  gotAgent: string;
  whatBrings: string;
  timeline: string;
  needToSellFirst: string;
  specificRequirements?: string;
};

export async function notifyCheckIn(details: CheckInNotification): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;

  // NRIC is deliberately NOT included. It is PDPA-sensitive and is already kept out of
  // the /leads table view for the same reason — a Telegram channel is a far wider and
  // less controlled audience than the Lark base. See gotcha #6 in CLAUDE.md.
  const lines = [
    "🏠 <b>New Open House Check-in</b>",
    "",
    `<b>Name:</b> ${escapeHtml(details.name)}`,
    `<b>Contact:</b> ${escapeHtml(details.contact)}`,
    `<b>Property:</b> ${escapeHtml(details.property)}`,
    `<b>Served by:</b> ${escapeHtml(details.agent)}`,
    "",
    `<b>Has own agent:</b> ${escapeHtml(details.gotAgent)}`,
    `<b>Purpose:</b> ${escapeHtml(details.whatBrings)}`,
    `<b>Timeline:</b> ${escapeHtml(details.timeline)}`,
    `<b>Needs to sell first:</b> ${escapeHtml(details.needToSellFirst)}`,
  ];

  if (details.specificRequirements) {
    lines.push("", `<b>Looking for:</b> ${escapeHtml(details.specificRequirements)}`);
  }

  const payload: Record<string, unknown> = {
    chat_id: CHAT_ID,
    text: lines.join("\n"),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  // Telegram expects an integer here; a string is rejected outright rather than coerced.
  if (TOPIC_ID) payload.message_thread_id = Number(TOPIC_ID);

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed (${res.status}): ${detail}`);
  }
}
