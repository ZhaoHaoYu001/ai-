import test from "node:test";
import assert from "node:assert/strict";
import { analyze, applyAiFeedback, buildSessionInsights, reply, selectMaterialCorrections, summarize } from "../src/coach.js";
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
  assert.equal(result.scoringEvidence.confidence, "medium");
});

test("does not award a high overall score to an extremely short answer", () => {
  const result = analyze("Yes.", 2);
  assert.ok(result.scores.overall <= 45);
  assert.equal(result.scoringEvidence.confidence, "low");
  assert.equal(result.scoringEvidence.metrics.durationSeconds, 2);
});

test("allows weak evidence to produce scores below the old artificial floor", () => {
  const result = analyze("Um.", 8, { clarity: 18, level: "clarity-proxy" });
  assert.ok(result.scores.fluency < 55);
  assert.equal(result.scores.pronunciation, 18);
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
  const answer = "I led a launch last year.";
  const result = applyAiFeedback(local, {
    encouragement: "成果表达清楚。",
    grammarScore: 95,
    vocabularyScore: 89,
    corrections: [{ original: "led a launch", improved: "led a successful launch", reason: "表达更具体。" }]
  }, answer);
  assert.equal(result.scores.pronunciation, 78);
  assert.equal(result.scores.grammar, 95);
  assert.equal(result.corrections.length, 1);
  assert.equal(result.assessmentMode, "ai");
});

test("filters hallucinated, duplicate, and no-op AI corrections", () => {
  const fallback = [{ original: "years experience", improved: "years of experience", reason: "需要 of" }];
  const result = selectMaterialCorrections("I have three years experience.", [
    { original: "I worked at Google", improved: "I work at Google", reason: "不存在于回答" },
    { original: "years experience", improved: "years of experience", reason: "需要 of" },
    { original: "years experience", improved: "years of experience", reason: "重复" },
    { original: "three", improved: "three", reason: "没有变化" }
  ], fallback);
  assert.equal(result.length, 1);
  assert.equal(result[0].original, "years experience");
  assert.equal(result[0].timing, "after-turn");
});

test("falls back to deterministic corrections when AI suggestions are unreliable", () => {
  const fallback = [{ original: "very like", improved: "really like", reason: "副词搭配" }];
  const result = selectMaterialCorrections("I very like design.", [
    { original: "missing phrase", improved: "better phrase", reason: "幻觉建议" }
  ], fallback);
  assert.equal(result[0].original, "very like");
});

test("keeps the short-answer ceiling after AI feedback", () => {
  const local = analyze("Yes.", 2);
  const result = applyAiFeedback(local, { grammarScore: 100, vocabularyScore: 100, corrections: [] }, "Yes.");
  assert.ok(result.scores.overall <= 45);
});

test("session summary aggregates measurable learning metrics", () => {
  const analysis = analyze("I really like solving difficult customer problems.", 6);
  const summary = summarize([{ role: "user", text: "answer", analysis }]);
  assert.equal(summary.turns, 1);
  assert.equal(summary.words, analysis.words);
  assert.equal(summary.overall, analysis.scores.overall);
  assert.equal(summary.pronunciation, null);
});

test("builds personalized session insights from scores, corrections, and history", () => {
  const analysis = analyze("I have three years experience and I very like product design.", 8);
  const insights = buildSessionInsights(
    [{ role: "user", text: "answer", analysis }],
    scenarios[0],
    [{ overall: analysis.scores.overall - 5 }]
  );
  assert.match(insights.strength, /分/);
  assert.match(insights.focus, /下一步重点/);
  assert.match(insights.correction, /优先复练/);
  assert.match(insights.nextTask, /求职面试/);
  assert.match(insights.trend, /提高 5 分/);
});
