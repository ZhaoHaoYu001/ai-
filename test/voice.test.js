import test from "node:test";
import assert from "node:assert/strict";
import { recognitionTranscript, translateCoachText } from "../src/voice.js";

test("separates final and interim live speech transcripts", () => {
  const result = recognitionTranscript([
    { isFinal: true, 0: { transcript: "I finished the research" } },
    { isFinal: false, 0: { transcript: "and I am preparing" } }
  ]);
  assert.equal(result.finalText, "I finished the research");
  assert.equal(result.interimText, "and I am preparing");
});

test("translates scenario opening into Chinese", () => {
  const text = "Good evening! Welcome to Olive Kitchen. Do you have a reservation with us?";
  assert.match(translateCoachText(text, "restaurant"), /预订/);
});

test("combines translations for a coach bridge and follow-up", () => {
  const text = "Good reasoning. You explained that clearly. What achievement are you most proud of?";
  const translation = translateCoachText(text, "interview");
  assert.match(translation, /理由充分/);
  assert.match(translation, /成就/);
});
