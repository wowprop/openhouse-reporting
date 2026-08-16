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

/** Formats an ISO date (yyyy-mm-dd) as "15 Aug, Sat" per the spec. */
export function formatReportDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = d.toLocaleDateString("en-SG", { day: "2-digit" });
  const month = d.toLocaleDateString("en-SG", { month: "short" });
  const weekday = d.toLocaleDateString("en-SG", { weekday: "short" });
  return `${day} ${month}, ${weekday}`;
}
