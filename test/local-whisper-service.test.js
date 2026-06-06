import test from "node:test";
import assert from "node:assert/strict";
import { decodePcmWav, createLocalWhisperService } from "../local-whisper-service.js";

function pcm16Wav(samples, sampleRate = 16000) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(sample, 44 + index * 2));
  return buffer;
}

test("decodes the browser 16 kHz PCM WAV format for local Whisper", () => {
  const samples = decodePcmWav(pcm16Wav([0, 16384, -16384]));
  assert.deepEqual([...samples], [0, .5, -.5]);
});

test("local Whisper service loads once and returns an English transcript", async () => {
  let loads = 0;
  let received;
  const service = createLocalWhisperService({
    model: "test-whisper",
    loadPipeline: async () => {
      loads += 1;
      return async (_task, model) => {
        assert.equal(model, "test-whisper");
        return async samples => {
          received = samples;
          return { text: " I led the launch. " };
        };
      };
    }
  });

  const audio = pcm16Wav(new Array(160).fill(1000));
  assert.equal((await service.transcribe(audio)).text, "I led the launch.");
  assert.equal((await service.transcribe(audio)).provider, "local-whisper");
  assert.equal(received.length, 160);
  assert.equal(loads, 1);
});
