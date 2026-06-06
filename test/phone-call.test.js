import test from "node:test";
import assert from "node:assert/strict";
import { callPhaseCopy, createVoiceActivityGate } from "../src/phone-call.js";

test("phone call VAD waits for speech before treating silence as a completed turn", () => {
  const gate = createVoiceActivityGate({ silenceMs: 1000 });
  assert.equal(gate.update({ peakLevel: 0 }, 0).shouldFinish, false);
  assert.equal(gate.update({ peakLevel: 0 }, 5000).shouldFinish, false);
  assert.equal(gate.update({ peakLevel: .08 }, 5100).heardSpeech, true);
  assert.equal(gate.update({ peakLevel: .01 }, 5500).shouldFinish, false);
  assert.equal(gate.update({ peakLevel: .01 }, 6600).shouldFinish, true);
});

test("phone call VAD accepts a live transcript as speech activity", () => {
  const gate = createVoiceActivityGate({ silenceMs: 500 });
  assert.equal(gate.update({ hasTranscript: true }, 100).heardSpeech, true);
  gate.update({ peakLevel: 0 }, 200);
  assert.equal(gate.update({ peakLevel: 0 }, 701).shouldFinish, true);
});

test("phone call phases explain the active turn-taking state", () => {
  assert.match(callPhaseCopy("speaking")[0], /AI Coach/);
  assert.match(callPhaseCopy("listening")[1], /自动发送/);
  assert.match(callPhaseCopy("thinking")[0], /思考/);
});
