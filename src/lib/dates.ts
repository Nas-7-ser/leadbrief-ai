import type { SavedProspect } from "../types/prospect";

/** Local calendar day as YYYY-MM-DD for `<input type="date">`. */
export function todayDateInputValue(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Parse YYYY-MM-DD from a date input as local noon — avoids UTC off-by-one display bugs. */
export function followUpDateToIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

/** True when today (local calendar) is on or after the scheduled follow-up date. */
export function isFollowUpDue(prospect: Pick<SavedProspect, "status" | "followUpAt">): boolean {
  if (prospect.status !== "follow_up" || !prospect.followUpAt) return false;
  const reminder = new Date(prospect.followUpAt);
  const now = new Date();
  const reminderDay = new Date(reminder.getFullYear(), reminder.getMonth(), reminder.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today.getTime() >= reminderDay.getTime();
}
