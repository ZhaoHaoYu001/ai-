const clamp = value => Math.max(0, Math.min(100, Math.round(value)));

export function createBrowserSpeechEvidence({
  confidence = 0,
  averageLevel = 0,
  peakLevel = 0,
  activeRatio = 0
} = {}) {
  const normalizedConfidence = clamp(confidence * 100);
  const signalQuality = clamp(averageLevel * 180 + peakLevel * 35);
  const voiceActivity = clamp(activeRatio * 120);
  const clarity = clamp(normalizedConfidence * .65 + signalQuality * .2 + voiceActivity * .15);

  return {
    provider: "browser",
    level: "clarity-proxy",
    clarity,
    confidence: normalizedConfidence,
    signalQuality,
    voiceActivity,
    disclaimer: "浏览器级清晰度代理分，不代表音素、重音或语调准确度。"
  };
}

export function createProfessionalEvidence(result) {
  return {
    provider: result.provider,
    level: "phoneme",
    clarity: clamp(result.overall),
    confidence: clamp(result.confidence ?? result.overall),
    signalQuality: clamp(result.signalQuality ?? 100),
    voiceActivity: clamp(result.completeness ?? 100),
    accuracy: clamp(result.accuracy ?? result.overall),
    fluency: clamp(result.fluency ?? result.overall),
    completeness: clamp(result.completeness ?? result.overall),
    prosody: Number.isFinite(result.prosody) ? clamp(result.prosody) : null,
    phonemes: result.phonemes || [],
    words: result.words || [],
    disclaimer: "专业音素级发音评测结果。"
  };
}

export function createSpeechAssessmentClient(config = {}) {
  return {
    mode: config.endpoint ? "professional" : "browser",
    async assess(audioBlob, transcript, browserEvidence) {
      if (!config.endpoint || !(audioBlob instanceof Blob)) return createBrowserSpeechEvidence(browserEvidence);
      try {
        const endpoint = `${config.endpoint}?text=${encodeURIComponent(transcript)}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": audioBlob.type || "audio/wav" },
          body: audioBlob
        });
        if (!response.ok) throw new Error(`Pronunciation service failed: ${response.status}`);
        return createProfessionalEvidence(await response.json());
      } catch {
        return {
          ...createBrowserSpeechEvidence(browserEvidence),
          fallbackReason: "专业评测服务暂时不可用，已降级为浏览器清晰度代理。"
        };
      }
    }
  };
}
