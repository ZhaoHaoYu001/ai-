import { analyze, applyAiFeedback, reply } from "./coach.js";
import { contextualAnswerSupport, normalizeAnswerSupport } from "./answer-support.js";

export function createAiCoachClient({
  endpoint = "/api/coach/stream",
  request = globalThis.fetch,
  timeoutMs = 60_000
} = {}) {
  return {
    async respond({ scenario, messages, text, seconds, speechEvidence }) {
      const localAnalysis = analyze(text, seconds, speechEvidence);
      const startedAt = performance.now();
      let firstByteMs = null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await request(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
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
        let result;
        if (response.body?.getReader) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let pending = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (firstByteMs === null) firstByteMs = Math.round(performance.now() - startedAt);
            pending += decoder.decode(value, { stream: true });
            const lines = pending.split("\n");
            pending = lines.pop() || "";
            for (const line of lines) {
              if (!line) continue;
              const event = JSON.parse(line);
              if (event.type === "final") result = event.result;
              if (event.type === "error") throw new Error(event.error);
            }
          }
          if (!result) throw new Error("AI stream ended without a final result");
        } else result = await response.json();
        return {
          mode: "ai",
          provider: result.provider || "ai",
          model: result.model || null,
          analysis: applyAiFeedback(localAnalysis, result.feedback, text),
          latency: { firstByteMs, aiMs: Math.round(performance.now() - startedAt), transport: response.body?.getReader ? "stream" : "json" },
          coach: {
            text: result.coachReply,
            translation: result.translation,
            support: normalizeAnswerSupport(result.support, contextualAnswerSupport(scenario, result.coachReply))
          }
        };
      } catch {
        const turn = messages.filter(message => message.role === "user").length;
        const coachText = reply(scenario, turn, text);
        return {
          mode: "offline",
          provider: null,
          model: null,
          analysis: localAnalysis,
          latency: { firstByteMs, aiMs: Math.round(performance.now() - startedAt), transport: "offline" },
          coach: { text: coachText, support: contextualAnswerSupport(scenario, coachText) }
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
