import test from "node:test";
import assert from "node:assert/strict";
import { buildSessionRecord, hasPracticeEvidence, loadHistory, saveSessionRecord } from "../src/history.js";
import { analyze, buildSessionInsights, summarize } from "../src/coach.js";
import { scenarios } from "../src/data.js";

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; }
  };
}

test("loads an empty history when local data is corrupted", () => {
  assert.deepEqual(loadHistory(memoryStorage("{not-json")), []);
});

test("requires at least one learner answer before recording practice", () => {
  assert.equal(hasPracticeEvidence({ turns: 0, words: 0 }), false);
  assert.equal(hasPracticeEvidence({ turns: 1, words: 1 }), true);
});

test("stores compact reviewable turns with corrections and pronunciation practice", () => {
  const scenario = scenarios[0];
  const analysis = analyze("I have three years experience.", 5, {
    clarity: 72,
    level: "phoneme",
    focusWords: [{ word: "experience", score: 61 }],
    practiceTips: ["慢速读准 experience。"]
  });
  const messages = [
    { role: "coach", text: scenario.opening },
    { role: "user", text: "I have three years experience.", analysis }
  ];
  const summary = summarize(messages);
  const insights = buildSessionInsights(messages, scenario, []);
  const record = buildSessionRecord({ messages, scenario, summary, insights, date: new Date("2026-06-07T10:00:00Z") });

  assert.equal(record.reviewTurns[0].prompt, scenario.opening);
  assert.equal(record.reviewTurns[0].corrections.length, 1);
  assert.deepEqual(record.reviewTurns[0].pronunciation.practiceTips, ["慢速读准 experience。"]);
  assert.equal(record.insights.measurableGoal, insights.measurableGoal);
});

test("keeps detailed review data for recent sessions and summary history for trends", () => {
  const storage = memoryStorage();
  for (let index = 0; index < 35; index += 1) {
    saveSessionRecord({ id: String(index), date: `2026-06-${String(index + 1).padStart(2, "0")}`, reviewTurns: [{ answer: "hello" }], insights: {} }, storage);
  }
  const history = loadHistory(storage);
  assert.equal(history.length, 35);
  assert.ok(history[29].reviewTurns);
  assert.equal(history[30].reviewTurns, undefined);
});
