export type FollowUpStatus =
  | "Not Started"
  | "In Progress"
  | "Follow-up Done"
  | "Not Interested"
  | "Converted";

export const FOLLOW_UP_OPTIONS: FollowUpStatus[] = [
  "Not Started",
  "In Progress",
  "Follow-up Done",
  "Not Interested",
  "Converted",
];

export interface BuyerReferenceInput {
  last4: string;
  feedback: string;
  followUpStatus: FollowUpStatus;
}

export interface WeeklyReportInput {
  date: string; // ISO yyyy-mm-dd from the date picker; formatted server-side to "DD Mmm, Day"
  propertyRecordId: string; // linked Properties record
  submittedBy: string;
  groups: number;
  potentialLeads: number;
  buyerReferences: BuyerReferenceInput[];
}

export interface PropertyOption {
  recordId: string;
  address: string;
}

export interface AgentOption {
  recordId: string;
  name: string;
}

// Option labels below are sent to Lark as-is for the matching single-select fields —
// keep them in sync with the exact option strings configured on the Walk-in Leads table.
export const GOT_AGENT_OPTIONS = ["Yes", "No"] as const;

export const WHAT_BRINGS_OPTIONS = [
  "Looking to Buy a Landed Property",
  "Exploring / Just Looking Around",
  "Looking on Behalf of Family / Someone Else",
  "Other",
] as const;

export const TIMELINE_OPTIONS = [
  "Ready to buy / Actively looking",
  "Within 3 Months",
  "Within 6 Months",
  "Just Exploring for Now",
] as const;

export const NEED_TO_SELL_OPTIONS = ["Yes", "No", "Not Sure / Would Like Advice"] as const;

export interface CheckInInput {
  name: string;
  contact: string;
  propertyRecordId: string;
  agentRecordId: string;
  gotAgent: (typeof GOT_AGENT_OPTIONS)[number];
  whatBrings: (typeof WHAT_BRINGS_OPTIONS)[number];
  timeline: (typeof TIMELINE_OPTIONS)[number];
  needToSellFirst: (typeof NEED_TO_SELL_OPTIONS)[number];
  specificRequirements: string;
  nric: string;
}

/** Formats an ISO date (yyyy-mm-dd) as "15 Aug, Sat" per the spec. */
export function formatReportDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = d.toLocaleDateString("en-SG", { day: "2-digit" });
  const month = d.toLocaleDateString("en-SG", { month: "short" });
  const weekday = d.toLocaleDateString("en-SG", { weekday: "short" });
  return `${day} ${month}, ${weekday}`;
}
