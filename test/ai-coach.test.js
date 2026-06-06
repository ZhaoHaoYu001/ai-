import test from "node:test";
import assert from "node:assert/strict";
import { createAiCoachClient } from "../src/ai-coach.js";
import { scenarios } from "../src/data.js";

const context = {
  scenario: scenarios[0],
  messages: [{ role: "coach", text: scenarios[0].opening }],
  text: "I led a product launch last year.",
  seconds: 8,
  speechEvidence: null
};

test("browser AI client applies contextual model feedback", async () => {
  const client = createAiCoachClient({
    request: async () => ({
      ok: true,
      async json() {
        return {
          provider: "anthropic",
          model: "mimo-v2.5",
          coachReply: "What measurable result did the launch achieve?",
          translation: "这次发布取得了什么可量化成果？",
          feedback: {
            encouragement: "成果表达很清楚。",
            grammarScore: 96,
            vocabularyScore: 91,
            corrections: []
          }
        };
      }
    })
  });

  const result = await client.respond(context);
  assert.equal(result.mode, "ai");
  assert.equal(result.provider, "anthropic");
  assert.equal(result.model, "mimo-v2.5");
  assert.equal(result.analysis.assessmentMode, "ai");
  assert.equal(result.analysis.scores.grammar, 96);
  assert.match(result.coach.text, /measurable result/);
});

test("browser AI client clearly falls back when the service is unavailable", async () => {
  const client = createAiCoachClient({ request: async () => ({ ok: false, status: 503 }) });
  const result = await client.respond(context);
  assert.equal(result.mode, "offline");
  assert.equal(result.provider, null);
  assert.match(result.coach.text, /achievement/i);
});

test("browser AI client times out and falls back without blocking the session", async () => {
  const client = createAiCoachClient({
    timeoutMs: 5,
    request: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    })
  });
  const result = await client.respond(context);
  assert.equal(result.mode, "offline");
  assert.match(result.coach.text, /achievement/i);
});

test("browser AI client consumes NDJSON streaming results and reports latency", async () => {
  const encoder = new TextEncoder();
  const result = {
    coachReply: "What happened next?",
    translation: "接下来发生了什么？",
    feedback: { encouragement: "表达清楚。", grammarScore: 92, vocabularyScore: 90, corrections: [] }
  };
  const client = createAiCoachClient({
    request: async () => ({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "accepted" })}\n`));
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: "final", result })}\n`));
          controller.close();
        }
      })
    })
  });
  const response = await client.respond(context);
  assert.equal(response.mode, "ai");
  assert.equal(response.latency.transport, "stream");
  assert.ok(Number.isFinite(response.latency.firstByteMs));
});
