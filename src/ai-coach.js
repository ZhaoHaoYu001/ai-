import { analyze, applyAiFeedback, reply } from "./coach.js";
import { contextualAnswerSupport, normalizeAnswerSupport } from "./answer-support.js";

export function createAiCoachClient({
  endpoint = "/api/coach/stream",
  request = globalThis.fetch,
  timeoutMs = 60_000,
  retryDelayMs = 250
} = {}) {
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  async function requestTurn(payload, startedAt) {
    let firstByteMs = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await request(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = new Error(`AI Coach failed: ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }

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
            if (event.type === "error") {
              const error = new Error(event.error || "AI Coach stream failed");
              error.retryable = true;
              throw error;
            }
          }
        }
        if (!result) {
          const error = new Error("AI stream ended without a final result");
          error.retryable = true;
          throw error;
        }
      } else {
        result = await response.json();
      }
      return { result, firstByteMs, transport: response.body?.getReader ? "stream" : "json" };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async respond({ scenario, messages, text, seconds, speechEvidence }) {
      const localAnalysis = analyze(text, seconds, speechEvidence);
      const startedAt = performance.now();
      const payload = {
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
      };
      let failure;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { result, firstByteMs, transport } = await requestTurn(payload, startedAt);
          return {
            mode: "ai",
            provider: result.provider || "ai",
            model: result.model || null,
            analysis: applyAiFeedback(localAnalysis, result.feedback, text),
            latency: { firstByteMs, aiMs: Math.round(performance.now() - startedAt), transport, attempts: attempt + 1 },
            coach: {
              text: result.coachReply,
              translation: result.translation,
              support: normalizeAnswerSupport(result.support, contextualAnswerSupport(scenario, result.coachReply))
            }
          };
        } catch (error) {
          failure = error;
          if (attempt === 0 && (error.retryable || error.name === "AbortError" || error instanceof TypeError)) {
            await wait(retryDelayMs);
            continue;
          }
          break;
        }
      }

      const turn = messages.filter(message => message.role === "user").length;
      const coachText = reply(scenario, turn, text);
      return {
        mode: "offline",
        provider: null,
        model: null,
        fallbackReason: failure?.name === "AbortError" ? "AI 响应超时，已切换到离线教练。" : "AI 服务暂时不可用，已切换到离线教练。",
        analysis: localAnalysis,
        latency: { firstByteMs: null, aiMs: Math.round(performance.now() - startedAt), transport: "offline" },
        coach: { text: coachText, support: contextualAnswerSupport(scenario, coachText) }
      };
    }
  };
}
