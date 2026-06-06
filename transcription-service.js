function normalizeAzureTranscript(result) {
  const text = result.DisplayText || result.NBest?.[0]?.Display || result.NBest?.[0]?.Lexical;
  if (!text?.trim()) throw new Error(`Azure Speech did not recognize speech (${result.RecognitionStatus || "unknown"})`);
  return {
    provider: "azure-speech",
    text: text.trim(),
    confidence: result.NBest?.[0]?.Confidence ?? null
  };
}

export function createAzureTranscriptionService({
  key = process.env.AZURE_SPEECH_KEY,
  region = process.env.AZURE_SPEECH_REGION,
  language = process.env.AZURE_SPEECH_LANGUAGE || "en-US",
  request = globalThis.fetch
} = {}) {
  return {
    provider: "azure-speech",
    available: Boolean(key && region),
    async transcribe(audio) {
      if (!key || !region) throw new Error("Azure Speech transcription is not configured");
      const url = new URL(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`);
      url.searchParams.set("language", language);
      url.searchParams.set("format", "detailed");
      const response = await request(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
          Accept: "application/json"
        },
        body: audio
      });
      if (!response.ok) throw new Error(`Azure Speech transcription failed (${response.status})`);
      return normalizeAzureTranscript(await response.json());
    }
  };
}
