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

export function buildSessionInsights(messages, scenario, history = []) {
  const summary = summarize(messages);
  const labels = { fluency: "流利度", grammar: "语法准确度", vocabulary: "词汇丰富度", pronunciation: "语音清晰度" };
  const dimensions = Object.keys(labels)
    .map(key => ({ key, label: labels[key], score: summary[key] }))
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);
  const corrections = messages
    .filter(message => message.role === "user")
    .flatMap(message => message.analysis.corrections || []);
  const correctionCounts = new Map();
  for (const correction of corrections) {
    const key = correction.improved || correction.reason;
    correctionCounts.set(key, (correctionCounts.get(key) || 0) + 1);
  }
  const frequentCorrection = [...correctionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const previousScores = history.map(item => Number(item.overall)).filter(Number.isFinite).slice(0, 5);
  const previousAverage = previousScores.length ?
    Math.round(previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length) : null;
  const trend = Number.isFinite(summary.overall) && Number.isFinite(previousAverage) ?
    summary.overall - previousAverage : null;

  return {
    strength: dimensions[0] ? `${dimensions[0].label}是本次优势（${dimensions[0].score} 分）。` : "完成更多回答后可识别优势能力。",
    focus: dimensions.at(-1) ? `${dimensions.at(-1).label}是下一步重点（${dimensions.at(-1).score} 分）。` : "完成语音回答后可生成重点建议。",
    correction: frequentCorrection ? `优先复练：${frequentCorrection[0]}${frequentCorrection[1] > 1 ? `（出现 ${frequentCorrection[1]} 次）` : ""}。` : "本次没有发现需要优先复练的表达错误。",
    nextTask: `下一次继续练习“${scenario.title}”，目标是：${scenario.goal}。`,
    trend: trend === null ? "完成更多练习后将显示历史趋势。" :
      trend > 0 ? `综合分比最近练习平均提高 ${trend} 分。` :
      trend < 0 ? `综合分比最近练习平均低 ${Math.abs(trend)} 分，建议针对重点能力复练。` :
      "综合分与最近练习平均持平。"
  };
}
