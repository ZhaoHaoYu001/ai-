import test from "node:test";
import assert from "node:assert/strict";
import { createBrowserSpeechEvidence, createProfessionalEvidence, createSpeechAssessmentClient } from "../src/speech-assessment.js";

test("browser evidence is clearly labeled as a proxy", () => {
  const evidence = createBrowserSpeechEvidence({ confidence: .92, averageLevel: .25, peakLevel: .8, activeRatio: .7 });
  assert.equal(evidence.level, "clarity-proxy");
  assert.match(evidence.disclaimer, /不代表音素/);
  assert.ok(evidence.clarity > 70);
});

test("professional evidence preserves word and phoneme diagnostics", () => {
  const evidence = createProfessionalEvidence({ provider: "demo", overall: 88, words: [{ word: "hello", score: 82 }], phonemes: [{ phoneme: "h", score: 80 }] });
  assert.equal(evidence.level, "phoneme");
  assert.equal(evidence.words.length, 1);
  assert.equal(evidence.phonemes.length, 1);
});

test("assessment client falls back to browser evidence without endpoint", async () => {
  const client = createSpeechAssessmentClient();
  const result = await client.assess(null, "hello", { confidence: .8, averageLevel: .2, peakLevel: .6, activeRatio: .5 });
  assert.equal(client.mode, "browser");
  assert.equal(result.provider, "browser");
});
