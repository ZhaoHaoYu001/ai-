import test from "node:test";
import assert from "node:assert/strict";
import { contextualAnswerSupport, normalizeAnswerSupport } from "../src/answer-support.js";
import { scenarios } from "../src/data.js";

test("changes answer support with the current coach question", () => {
  const scenario = scenarios.find(item => item.id === "interview");
  const result = contextualAnswerSupport(scenario, "What measurable result did the launch achieve?");
  assert.match(result.starters[0], /result/i);
  assert.ok(result.keywords.includes("impact"));
  assert.match(result.example, /20%/);
});

test("normalizes AI support and falls back when it is incomplete", () => {
  const fallback = scenarios[0].support;
  const result = normalizeAnswerSupport({
    starters: ["First...", "Then...", "Finally..."],
    keywords: [],
    example: ""
  }, fallback);
  assert.deepEqual(result.starters, ["First...", "Then...", "Finally..."]);
  assert.deepEqual(result.keywords, fallback.keywords);
  assert.equal(result.example, fallback.example);
});
