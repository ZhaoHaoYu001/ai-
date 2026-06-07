export const HISTORY_KEY = "fluentloop-history";
const MAX_SESSIONS = 180;
const MAX_DETAILED_SESSIONS = 30;
const MAX_REVIEW_TURNS = 12;

export function loadHistory(storage = globalThis.localStorage) {
  try {
    const history = JSON.parse(storage?.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history.filter(item => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

export function buildSessionRecord({ messages, scenario, summary, insights, date = new Date() }) {
  let latestCoach = scenario.opening;
  const reviewTurns = [];
  for (const message of messages) {
    if (message.role === "coach") {
      latestCoach = message.text;
      continue;
    }
    if (message.role !== "user") continue;
    const evidence = message.analysis?.speechEvidence;
    reviewTurns.push({
      prompt: latestCoach,
      answer: message.text,
      scores: message.analysis?.scores || {},
      corrections: (message.analysis?.corrections || []).slice(0, 2).map(({ original, improved, reason }) => ({
        original, improved, reason
      })),
      pronunciation: evidence ? {
        level: evidence.level,
        focusWords: (evidence.focusWords || []).slice(0, 3),
        practiceTips: (evidence.practiceTips || []).slice(0, 2)
      } : null
    });
  }
  const isoDate = date instanceof Date ? date.toISOString() : String(date);
  return {
    ...summary,
    id: `${isoDate}-${scenario.id}`,
    scenarioId: scenario.id,
    scenario: scenario.title,
    date: isoDate,
    insights: {
      strength: insights.strength,
      focus: insights.focus,
      correction: insights.correction,
      measurableGoal: insights.measurableGoal,
      nextTask: insights.nextTask
    },
    reviewTurns: reviewTurns.slice(-MAX_REVIEW_TURNS)
  };
}

export function saveSessionRecord(record, storage = globalThis.localStorage) {
  const history = loadHistory(storage).filter(item => item.id !== record.id);
  history.unshift(record);
  const compact = history.slice(0, MAX_SESSIONS).map((item, index) => index < MAX_DETAILED_SESSIONS ? item : stripReviewDetails(item));
  try {
    storage?.setItem(HISTORY_KEY, JSON.stringify(compact));
  } catch {
    storage?.setItem(HISTORY_KEY, JSON.stringify(compact.slice(0, MAX_DETAILED_SESSIONS)));
  }
  return compact;
}

function stripReviewDetails({ reviewTurns, insights, ...summary }) {
  return summary;
}
