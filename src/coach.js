import { rules } from "./data.js";

const clamp = value => Math.max(0, Math.min(100, Math.round(value)));

export function analyze(text, seconds = 10, speechEvidence = null) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words.map(word => word.toLowerCase())).size;
  const fillers = text.match(/\b(um+|uh+|like|you know|basically)\b/gi) || [];
  const corrections = rules.filter(([pattern]) => pattern.test(text)).map(([pattern, replacement, reason]) => ({
    original: text.match(pattern)?.[0] || "", improved: text.replace(pattern, replacement), reason
  }));
  const durationSeconds = Math.max(Number(seconds) || 0, 1);
  const wpm = Math.round(words.length / durationSeconds * 60);
  const shortAnswerPenalty = words.length < 5 ? (5 - words.length) * 12 : 0;
  const pacePenalty = Math.min(40, Math.abs(110 - wpm) * .22);
  const scores = {
    fluency: clamp(88 - pacePenalty - fillers.length * 10 - shortAnswerPenalty),
    grammar: clamp(96 - corrections.length * 18),
    vocabulary: clamp(50 + (words.length ? uniqueWords / words.length * 20 : 0) + Math.min(uniqueWords, 20) * 1.5 - shortAnswerPenalty),
    pronunciation: speechEvidence ? clamp(speechEvidence.clarity) : null
  };
  const scored = Object.values(scores).filter(Number.isFinite);
  scores.overall = clamp(scored.reduce((a, b) => a + b, 0) / scored.length);
  if (words.length < 5) scores.overall = Math.min(scores.overall, 35 + words.length * 10);
  const confidence = speechEvidence?.level === "phoneme" && words.length >= 12 ? "high" :
    words.length >= 8 ? "medium" : "low";
  const scoringEvidence = {
    confidence,
    metrics: { durationSeconds: Math.round(durationSeconds * 10) / 10, words: words.length, uniqueWords, fillers: fillers.length, corrections: corrections.length, wpm },
    reasons: [
      `${wpm} WPM，${words.length} 个单词`,
      fillers.length ? `${fillers.length} 个填充词影响流利度` : "未发现明显填充词",
      corrections.length ? `${corrections.length} 个表达问题影响准确度` : "未发现规则可识别的表达问题",
      speechEvidence ? `语音证据等级：${speechEvidence.level}` : "本轮没有语音证据"
    ]
  };
  return { words: words.length, fillers: fillers.length, wpm, corrections, scores, speechEvidence, scoringEvidence };
}

export function reply(scenario, turn, text) {
  const bridge = text.split(/\s+/).length < 8 ? "Good start. Try adding one specific detail." :
    /\b(could|would)\b/i.test(text) ? "Nice use of polite, natural phrasing." :
    /\bbecause\b/i.test(text) ? "Good reasoning. You explained that clearly." : "That's a clear answer.";
  return `${bridge} ${scenario.prompts[turn % scenario.prompts.length]}`;
}

export function applyAiFeedback(analysis, feedback = {}) {
  const scores = {
    ...analysis.scores,
    grammar: Number.isFinite(feedback.grammarScore) ? clamp(feedback.grammarScore) : analysis.scores.grammar,
    vocabulary: Number.isFinite(feedback.vocabularyScore) ? clamp(feedback.vocabularyScore) : analysis.scores.vocabulary
  };
  const scored = [scores.fluency, scores.grammar, scores.vocabulary, scores.pronunciation].filter(Number.isFinite);
  scores.overall = clamp(scored.reduce((sum, score) => sum + score, 0) / scored.length);
  if (analysis.words < 5) scores.overall = Math.min(scores.overall, 35 + analysis.words * 10);

  return {
    ...analysis,
    scores,
    corrections: Array.isArray(feedback.corrections) ? feedback.corrections.slice(0, 3) : analysis.corrections,
    encouragement: feedback.encouragement || null,
    assessmentMode: "ai"
  };
}

export function summarize(messages) {
  const analyses = messages.filter(m => m.role === "user").map(m => m.analysis);
  const avg = key => {
    const values = analyses.map(a => a.scores[key]).filter(Number.isFinite);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  };
  return {
    overall: avg("overall"), fluency: avg("fluency"), grammar: avg("grammar"),
    vocabulary: avg("vocabulary"), pronunciation: avg("pronunciation"),
    turns: analyses.length, words: analyses.reduce((s, a) => s + a.words, 0),
    corrections: analyses.reduce((s, a) => s + a.corrections.length, 0),
    wpm: analyses.length ? Math.round(analyses.reduce((s, a) => s + a.wpm, 0) / analyses.length) : 0
  };
}
