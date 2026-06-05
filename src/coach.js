import { rules } from "./data.js";

const clamp = value => Math.max(55, Math.min(98, Math.round(value)));

export function analyze(text, seconds = 10, speechEvidence = null) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const fillers = text.match(/\b(um+|uh+|like|you know|basically)\b/gi) || [];
  const corrections = rules.filter(([pattern]) => pattern.test(text)).map(([pattern, replacement, reason]) => ({
    original: text.match(pattern)?.[0] || "", improved: text.replace(pattern, replacement), reason
  }));
  const wpm = Math.round(words.length / Math.max(seconds, 5) * 60);
  const scores = {
    fluency: clamp(82 + Math.min(words.length, 20) * .5 - fillers.length * 8 - Math.abs(110 - wpm) * .06),
    grammar: clamp(94 - corrections.length * 14),
    vocabulary: clamp(72 + new Set(words.map(w => w.toLowerCase())).size * .9),
    pronunciation: speechEvidence ? clamp(speechEvidence.clarity) : null
  };
  const scored = Object.values(scores).filter(Number.isFinite);
  scores.overall = clamp(scored.reduce((a, b) => a + b, 0) / scored.length);
  return { words: words.length, fillers: fillers.length, wpm, corrections, scores, speechEvidence };
}

export function reply(scenario, turn, text) {
  const bridge = text.split(/\s+/).length < 8 ? "Good start. Try adding one specific detail." :
    /\b(could|would)\b/i.test(text) ? "Nice use of polite, natural phrasing." :
    /\bbecause\b/i.test(text) ? "Good reasoning. You explained that clearly." : "That's a clear answer.";
  return `${bridge} ${scenario.prompts[turn % scenario.prompts.length]}`;
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
