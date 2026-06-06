const clamp = value => Math.max(0, Math.min(100, Math.round(value)));

function browserPracticeTips({ confidence, signalQuality, voiceActivity }) {
  const tips = [];
  if (signalQuality < 55) tips.push("靠近麦克风并减少背景噪声，再录一遍同一句。");
  if (voiceActivity < 45) tips.push("尝试连续表达完整句子，减少过长停顿。");
  if (confidence < 70) tips.push("放慢语速并清晰读出关键词，观察转写是否更稳定。");
  return tips.length ? tips.slice(0, 2) : ["保持当前清晰度，下一轮尝试加入更自然的重音和停顿。"];
}

function professionalPracticeTargets(result) {
  const weakWords = (result.words || [])
    .filter(word => Number.isFinite(word.score) && (word.score < 80 || word.errorType !== "None"))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const tips = [];
  if (weakWords.length) tips.push(`优先复练：${weakWords.map(word => word.word).join("、")}。先慢速读准，再放回完整句子。`);
  if (Number.isFinite(result.fluency) && result.fluency < 75) {
    tips.push("按意群分段练习，保持每个短语内部连续发音。");
  } else if (Number.isFinite(result.prosody) && result.prosody < 75) {
    tips.push("突出关键词重音，并在句尾使用自然升降调。");
  } else if (Number.isFinite(result.accuracy) && result.accuracy < 80) {
    tips.push("先对照低分音素慢读，再逐步恢复自然语速。");
  }
  return {
    focusWords: weakWords.map(word => ({
      word: word.word,
      score: clamp(word.score),
      phonemes: (word.phonemes || []).filter(item => item.score < 80).slice(0, 3)
    })),
    practiceTips: tips.length ? tips.slice(0, 2) : ["本轮发音稳定；下一轮保持清晰度并尝试更自然的语调变化。"]
  };
}

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
  const practiceTips = browserPracticeTips({ confidence: normalizedConfidence, signalQuality, voiceActivity });

  return {
    provider: "browser",
    level: "clarity-proxy",
    clarity,
    confidence: normalizedConfidence,
    signalQuality,
    voiceActivity,
    focusWords: [],
    practiceTips,
    disclaimer: "浏览器级清晰度代理分，不代表音素、重音或语调准确度。"
  };
}

export function createProfessionalEvidence(result) {
  const targets = professionalPracticeTargets(result);
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
    ...targets,
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
