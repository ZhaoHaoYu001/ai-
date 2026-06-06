const DEFAULT_MODEL = "onnx-community/whisper-tiny.en";

export function decodePcmWav(audio) {
  const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset, length) => new TextDecoder("ascii").decode(bytes.subarray(offset, offset + length));
  if (bytes.byteLength < 44 || text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE") {
    throw new Error("Local Whisper requires a WAV recording");
  }

  let format = null;
  let dataOffset = null;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.byteLength;) {
    const chunk = text(offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (chunk === "fmt ") {
      format = {
        encoding: view.getUint16(offset + 8, true),
        channels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        bitsPerSample: view.getUint16(offset + 22, true)
      };
    }
    if (chunk === "data") {
      dataOffset = offset + 8;
      dataSize = Math.min(size, bytes.byteLength - dataOffset);
      break;
    }
    offset += 8 + size + (size % 2);
  }

  if (!format || dataOffset === null || format.encoding !== 1 || format.channels !== 1 ||
      format.sampleRate !== 16000 || format.bitsPerSample !== 16) {
    throw new Error("Local Whisper requires 16 kHz mono PCM16 WAV audio");
  }

  const samples = new Float32Array(Math.floor(dataSize / 2));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(dataOffset + index * 2, true) / 0x8000;
  }
  return samples;
}

export function createLocalWhisperService({
  model = process.env.LOCAL_WHISPER_MODEL || DEFAULT_MODEL,
  modelHost = process.env.HF_ENDPOINT || "https://hf-mirror.com/",
  loadPipeline = async () => {
    const transformers = await import("@huggingface/transformers");
    transformers.env.remoteHost = modelHost;
    return transformers.pipeline;
  }
} = {}) {
  let recognizerPromise = null;
  const recognizer = () => {
    recognizerPromise ??= loadPipeline()
      .then(pipeline => pipeline("automatic-speech-recognition", model, { dtype: "q8" }));
    return recognizerPromise;
  };

  return {
    provider: "local-whisper",
    model,
    available: true,
    warmup() {
      return recognizer();
    },
    async transcribe(audio) {
      const samples = decodePcmWav(audio);
      const durationSeconds = samples.length / 16000;
      const options = durationSeconds > 20 ? {
        chunk_length_s: 20,
        stride_length_s: 3
      } : {};
      const result = await (await recognizer())(samples, options);
      const text = result?.text?.trim();
      if (!text) throw new Error("Local Whisper did not recognize speech");
      return { provider: "local-whisper", model, text, confidence: null };
    }
  };
}
