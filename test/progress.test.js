import test from "node:test";
import assert from "node:assert/strict";
import { buildGrowthCalendar, toLocalDateKey } from "../src/progress.js";

test("groups multiple sessions into one checked day", () => {
  const calendar = buildGrowthCalendar([
    { date: "2026-06-05T08:00:00", overall: 82, words: 40 },
    { date: "2026-06-05T18:00:00", overall: 91, words: 65 }
  ], new Date("2026-06-06T12:00:00"));
  const day = calendar.cells.find(cell => cell?.key === "2026-06-05");
  assert.deepEqual(day.activity, { date: "2026-06-05", sessions: 2, bestScore: 91, words: 105 });
  assert.equal(calendar.activeDays, 1);
});

test("calculates a streak ending today", () => {
  const history = ["2026-06-04", "2026-06-05", "2026-06-06"].map(date => ({ date: `${date}T12:00:00` }));
  assert.equal(buildGrowthCalendar(history, new Date("2026-06-06T20:00:00")).streak, 3);
});

test("keeps a streak when today is not complete yet", () => {
  const history = ["2026-06-04", "2026-06-05"].map(date => ({ date: `${date}T12:00:00` }));
  assert.equal(buildGrowthCalendar(history, new Date("2026-06-06T08:00:00")).streak, 2);
});

test("uses local dates for growth records", () => {
  assert.equal(toLocalDateKey(new Date(2026, 5, 6, 23, 30)), "2026-06-06");
});
