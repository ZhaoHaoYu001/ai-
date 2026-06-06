import test from "node:test";
import assert from "node:assert/strict";
import { createAzureTranscriptionService } from "../transcription-service.js";

test("Azure transcription service sends WAV audio and normalizes recognized text", async () => {
  let request;
  const service = createAzureTranscriptionService({
    key: "secret",
    region: "eastus",
    request: async (url, options) => {
      request = { url: String(url), options };
      return {
        ok: true,
        async json() {
          return { RecognitionStatus: "Success", DisplayText: "I led the launch.", NBest: [{ Confidence: .91 }] };
        }
      };
    }
  });

  const result = await service.transcribe(Buffer.from("wav"));
  assert.equal(service.available, true);
  assert.match(request.url, /eastus\.stt\.speech\.microsoft\.com/);
  assert.equal(request.options.headers["Ocp-Apim-Subscription-Key"], "secret");
  assert.equal(result.text, "I led the launch.");
  assert.equal(result.confidence, .91);
});

test("Azure transcription service rejects empty recognition results", async () => {
  const service = createAzureTranscriptionService({
    key: "secret",
    region: "eastus",
    request: async () => ({ ok: true, json: async () => ({ RecognitionStatus: "NoMatch" }) })
  });
  await assert.rejects(service.transcribe(Buffer.from("wav")), /did not recognize speech/);
});
