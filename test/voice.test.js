import test from "node:test";
import assert from "node:assert/strict";
import { appendTurnTranscript, encodePcmWav, recognitionTranscript, requestMicrophoneStream, translateCoachText } from "../src/voice.js";

test("separates final and interim live speech transcripts", () => {
  const result = recognitionTranscript([
    { isFinal: true, 0: { transcript: "I finished the research" } },
    { isFinal: false, 0: { transcript: "and I am preparing" } }
  ]);
  assert.equal(result.finalText, "I finished the research");
  assert.equal(result.interimText, "and I am preparing");
});

test("keeps finalized speech segments in one explicit learner turn", () => {
  assert.equal(
    appendTurnTranscript("I led the launch", "and increased adoption"),
    "I led the launch and increased adoption"
  );
  assert.equal(appendTurnTranscript("", "  first segment  "), "first segment");
});

test("times out a stalled microphone request and closes a late stream", async () => {
  let resolveStream;
  let stopped = false;
  const mediaDevices = {
    getUserMedia: () => new Promise(resolve => { resolveStream = resolve; })
  };
  await assert.rejects(requestMicrophoneStream({ mediaDevices, timeoutMs: 5 }), /timed out/);
  resolveStream({ getTracks: () => [{ stop: () => { stopped = true; } }] });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(stopped, true);
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

test("encodes browser PCM samples as a 16 kHz WAV for professional assessment", async () => {
  const wav = encodePcmWav([new Float32Array(4800).fill(.25)], 48000);
  const bytes = new Uint8Array(await wav.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(new DataView(bytes.buffer).getUint32(24, true), 16000);
  assert.equal(wav.type, "audio/wav");
});
