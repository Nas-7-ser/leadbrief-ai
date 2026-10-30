import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { followUpDateToIso, isFollowUpDue, todayDateInputValue } from "./dates";

describe("follow-up dates", () => {
  it("keeps the calendar day the user picked", () => {
    const parsed = new Date(followUpDateToIso("2026-01-15"));
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 0);
    assert.equal(parsed.getDate(), 15);
  });

  it("formats today in local time, including late evening", () => {
    assert.equal(todayDateInputValue(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
  });

  it("is due on the follow-up day and not the day before", () => {
    const today = new Date();
    today.setHours(15, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);

    assert.equal(isFollowUpDue({ status: "follow_up", followUpAt: today.toISOString() }), true);
    assert.equal(isFollowUpDue({ status: "follow_up", followUpAt: tomorrow.toISOString() }), false);
    assert.equal(isFollowUpDue({ status: "contacted", followUpAt: today.toISOString() }), false);
    assert.equal(isFollowUpDue({ status: "follow_up" }), false);
  });
});
