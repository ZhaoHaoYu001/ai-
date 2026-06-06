import test from "node:test";
import assert from "node:assert/strict";
import { callPhaseCopy, createVoiceActivityGate } from "../src/phone-call.js";

test("phone call VAD waits for speech before treating silence as a completed turn", () => {
  const gate = createVoiceActivityGate({ speechConfirmMs: 500, silenceMs: 1000, minimumTurnMs: 0 });
  assert.equal(gate.update({ peakLevel: 0 }, 0).shouldFinish, false);
  assert.equal(gate.update({ peakLevel: 0 }, 5000).shouldFinish, false);
  assert.equal(gate.update({ averageLevel: .04, peakLevel: .08, activeRatio: .5 }, 5100).heardSpeech, false);
  assert.equal(gate.update({ averageLevel: .04, peakLevel: .08, activeRatio: .5 }, 5700).heardSpeech, true);
  assert.equal(gate.update({ peakLevel: .01 }, 6000).shouldFinish, false);
  assert.equal(gate.update({ peakLevel: .01 }, 7100).shouldFinish, true);
});

test("phone call VAD accepts a live transcript as speech activity", () => {
  const gate = createVoiceActivityGate({ silenceMs: 500, minimumTurnMs: 0 });
  assert.equal(gate.update({ hasTranscript: true }, 100).heardSpeech, true);
  gate.update({ peakLevel: 0 }, 200);
  assert.equal(gate.update({ peakLevel: 0 }, 701).shouldFinish, true);
});

test("phone call VAD ignores short noise bursts", () => {
  const gate = createVoiceActivityGate({ speechConfirmMs: 750, silenceMs: 1000, minimumTurnMs: 0 });
  assert.equal(gate.update({ averageLevel: .08, peakLevel: .5, activeRatio: .3 }, 0).confirmingSpeech, true);
  assert.equal(gate.update({ peakLevel: 0 }, 250).heardSpeech, false);
  assert.equal(gate.update({ peakLevel: 0 }, 3000).shouldFinish, false);
});

test("phone call VAD keeps listening through a short thinking pause", () => {
  const gate = createVoiceActivityGate({ speechConfirmMs: 0, silenceMs: 2400, minimumTurnMs: 2500 });
  gate.update({ averageLevel: .05, peakLevel: .08, activeRatio: .5 }, 0);
  gate.update({ averageLevel: .05, peakLevel: .08, activeRatio: .5 }, 500);
  assert.equal(gate.update({ peakLevel: 0 }, 1000).shouldFinish, false);
  assert.equal(gate.update({ peakLevel: 0 }, 3000).shouldFinish, false);
  assert.equal(gate.update({ peakLevel: 0 }, 3500).shouldFinish, true);
});

test("phone call VAD shortens silence only after a substantial transcribed answer", () => {
  const gate = createVoiceActivityGate({
    speechConfirmMs: 0,
    silenceMs: 2400,
    confidentSilenceMs: 1800,
    confidentTranscriptWords: 8,
    confidentTurnMs: 4000,
    minimumTurnMs: 0
  });
  gate.update({ hasTranscript: true, transcriptWords: 9 }, 0);
  gate.update({ hasTranscript: true, transcriptWords: 9 }, 4200);
  assert.equal(gate.update({ peakLevel: 0, transcriptWords: 9 }, 4300).silenceTargetMs, 1800);
  assert.equal(gate.update({ peakLevel: 0, transcriptWords: 9 }, 6000).shouldFinish, false);
  assert.equal(gate.update({ peakLevel: 0, transcriptWords: 9 }, 6200).shouldFinish, true);
});

test("phone call VAD keeps the safer silence window for short answers", () => {
  const gate = createVoiceActivityGate({ speechConfirmMs: 0, minimumTurnMs: 0 });
  gate.update({ hasTranscript: true, transcriptWords: 3 }, 0);
  gate.update({ peakLevel: 0, transcriptWords: 3 }, 5000);
  assert.equal(gate.update({ peakLevel: 0, transcriptWords: 3 }, 6800).silenceTargetMs, 2400);
  assert.equal(gate.update({ peakLevel: 0, transcriptWords: 3 }, 7000).shouldFinish, false);
  assert.equal(gate.update({ peakLevel: 0, transcriptWords: 3 }, 7500).shouldFinish, true);
});

test("phone call phases explain the active turn-taking state", () => {
  assert.match(callPhaseCopy("speaking")[0], /AI Coach/);
  assert.match(callPhaseCopy("listening")[1], /自动发送/);
  assert.match(callPhaseCopy("thinking")[0], /思考/);
});
