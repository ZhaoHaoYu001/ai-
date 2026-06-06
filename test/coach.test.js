import test from "node:test";
import assert from "node:assert/strict";
import { analyze, applyAiFeedback, reply, summarize } from "../src/coach.js";
import { scenarios } from "../src/data.js";

test("detects grammar and expression issues", () => {
  const result = analyze("I have three years experience and I very like product design.");
  assert.equal(result.corrections.length, 2);
  assert.ok(result.scores.grammar < 80);
  assert.match(result.corrections[0].improved, /years of experience/i);
});

test("returns strong scores for a clear natural response", () => {
  const result = analyze("I enjoy product design because it lets me turn complex problems into simple experiences.", 8);
  assert.equal(result.corrections.length, 0);
  assert.ok(result.scores.overall >= 80);
  assert.ok(result.wpm > 80);
  assert.equal(result.scores.pronunciation, null);
});

test("uses real speech evidence when calculating clarity score", () => {
  const evidence = { clarity: 73, level: "clarity-proxy" };
  const result = analyze("I enjoy solving customer problems.", 6, evidence);
  assert.equal(result.scores.pronunciation, 73);
  assert.equal(result.speechEvidence, evidence);
});

test("coach follows up based on the selected scenario", () => {
  const answer = reply(scenarios[0], 0, "I enjoy the role because I like solving customer problems.");
  assert.match(answer, /Good reasoning/);
  assert.match(answer, /achievement/i);
});

test("merges contextual AI feedback with measurable local speech metrics", () => {
  const local = analyze("I led a launch last year.", 6, { clarity: 78 });
  const result = applyAiFeedback(local, {
    encouragement: "成果表达清楚。",
    grammarScore: 95,
    vocabularyScore: 89,
    corrections: [{ original: "led a launch", improved: "led a successful launch", reason: "表达更具体。" }]
  });
  assert.equal(result.scores.pronunciation, 78);
  assert.equal(result.scores.grammar, 95);
  assert.equal(result.corrections.length, 1);
  assert.equal(result.assessmentMode, "ai");
});

test("session summary aggregates measurable learning metrics", () => {
  const analysis = analyze("I really like solving difficult customer problems.", 6);
  const summary = summarize([{ role: "user", text: "answer", analysis }]);
  assert.equal(summary.turns, 1);
  assert.equal(summary.words, analysis.words);
  assert.equal(summary.overall, analysis.scores.overall);
  assert.equal(summary.pronunciation, null);
});
