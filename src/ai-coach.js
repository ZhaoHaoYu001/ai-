import { analyze, applyAiFeedback, reply } from "./coach.js";

export function createAiCoachClient({
  endpoint = "/api/coach",
  request = globalThis.fetch
} = {}) {
  return {
    async respond({ scenario, messages, text, seconds, speechEvidence }) {
      const localAnalysis = analyze(text, seconds, speechEvidence);

      try {
        const response = await request(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: {
              id: scenario.id,
              title: scenario.en,
              level: scenario.level,
              goal: scenario.goal
            },
            messages: messages.slice(-12).map(message => ({
              role: message.role,
              text: message.text
            })),
            answer: text
          })
        });

        if (!response.ok) throw new Error(`AI Coach failed: ${response.status}`);
        const result = await response.json();
        return {
          mode: "ai",
          analysis: applyAiFeedback(localAnalysis, result.feedback),
          coach: {
            text: result.coachReply,
            translation: result.translation
          }
        };
      } catch {
        const turn = messages.filter(message => message.role === "user").length;
        return {
          mode: "offline",
          analysis: localAnalysis,
          coach: { text: reply(scenario, turn, text) }
        };
      }
    }
  };
}
