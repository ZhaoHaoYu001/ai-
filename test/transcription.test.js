import test from "node:test";
import assert from "node:assert/strict";
import { createTranscriptionClient, prepareLocalRecognition } from "../src/transcription.js";

test("browser transcription client uploads a recorded WAV turn", async () => {
  let request;
  const client = createTranscriptionClient({
    request: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ text: "I led the launch.", confidence: .9 }) };
    }
  });
  const audio = new Blob(["RIFFdemo"], { type: "audio/wav" });
  const result = await client.transcribe(audio);
  assert.equal(request.url, "/api/transcribe");
  assert.equal(request.options.headers["Content-Type"], "audio/wav");
  assert.equal(request.options.body, audio);
  assert.equal(result.text, "I led the launch.");
});

test("local recognition installs a downloadable language pack", async () => {
  let installed = false;
  const SpeechRecognition = {
    async available() {
      return installed ? "available" : "downloadable";
    },
    async install() {
      installed = true;
      return true;
    }
  };
  assert.equal(await prepareLocalRecognition(SpeechRecognition), true);
  assert.equal(installed, true);
});

test("local recognition degrades when the browser has no on-device API", async () => {
  assert.equal(await prepareLocalRecognition(function SpeechRecognition() {}), false);
});
