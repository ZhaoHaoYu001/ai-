function encodeAssessmentHeader(referenceText) {
  return Buffer.from(JSON.stringify({
    ReferenceText: referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableProsodyAssessment: true
  })).toString("base64");
}

function normalizeAzureResult(result) {
  const best = result.NBest?.[0];
  const assessment = best?.PronunciationAssessment;
  if (!assessment) throw new Error("Azure response did not contain pronunciation assessment");

  return {
    provider: "azure-speech",
    overall: assessment.PronScore,
    accuracy: assessment.AccuracyScore,
    fluency: assessment.FluencyScore,
    completeness: assessment.CompletenessScore,
    prosody: assessment.ProsodyScore,
    confidence: Math.round((best.Confidence || 0) * 100),
    words: (best.Words || []).map(word => ({
      word: word.Word,
      score: word.PronunciationAssessment?.AccuracyScore,
      errorType: word.PronunciationAssessment?.ErrorType || "None",
      phonemes: (word.Phonemes || []).map(phoneme => ({
        phoneme: phoneme.Phoneme,
        score: phoneme.PronunciationAssessment?.AccuracyScore
      }))
    }))
  };
}

export function createAzurePronunciationService({
  key = process.env.AZURE_SPEECH_KEY,
  region = process.env.AZURE_SPEECH_REGION,
  language = process.env.AZURE_SPEECH_LANGUAGE || "en-US",
  request = globalThis.fetch
} = {}) {
  return {
    provider: "azure-speech",
    available: Boolean(key && region),
    async assess(audio, referenceText) {
      if (!key || !region) throw new Error("Azure Speech pronunciation assessment is not configured");
      const url = new URL(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`);
      url.searchParams.set("language", language);
      url.searchParams.set("format", "detailed");
      const response = await request(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Pronunciation-Assessment": encodeAssessmentHeader(referenceText),
          "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
          Accept: "application/json"
        },
        body: audio
      });
      if (!response.ok) throw new Error(`Azure pronunciation assessment failed (${response.status})`);
      return normalizeAzureResult(await response.json());
    }
  };
}
