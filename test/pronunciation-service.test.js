import test from "node:test";
import assert from "node:assert/strict";
import { createAzurePronunciationService } from "../pronunciation-service.js";

test("Azure pronunciation service sends protected configuration and normalizes diagnostics", async () => {
  let request;
  const service = createAzurePronunciationService({
    key: "secret",
    region: "eastus",
    request: async (url, options) => {
      request = { url: String(url), options };
      return {
        ok: true,
        async json() {
          return {
            NBest: [{
              Confidence: .93,
              PronunciationAssessment: { PronScore: 87, AccuracyScore: 85, FluencyScore: 89, CompletenessScore: 100, ProsodyScore: 80 },
              Words: [{ Word: "hello", PronunciationAssessment: { AccuracyScore: 72, ErrorType: "None" }, Phonemes: [{ Phoneme: "h", PronunciationAssessment: { AccuracyScore: 68 } }] }]
            }]
          };
        }
      };
    }
  });
  const result = await service.assess(Buffer.from("wav"), "hello");
  assert.equal(service.available, true);
  assert.match(request.url, /eastus\.stt\.speech\.microsoft\.com/);
  assert.equal(request.options.headers["Ocp-Apim-Subscription-Key"], "secret");
  assert.equal(result.prosody, 80);
  assert.equal(result.words[0].phonemes[0].phoneme, "h");
});
