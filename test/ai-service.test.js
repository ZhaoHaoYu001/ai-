import test from "node:test";
import assert from "node:assert/strict";
import { createCoachService } from "../ai-service.js";

const payload = {
  scenario: { title: "Job Interview", level: "B2", goal: "Explain experience clearly" },
  messages: [{ role: "coach", text: "Tell me about yourself." }],
  answer: "I led a product launch last year."
};

test("AI coach sends context and returns structured feedback", async () => {
  let requestBody;
  const service = createCoachService({
    apiKey: "test-key",
    model: "test-model",
    request: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return {
            output_text: JSON.stringify({
              coachReply: "What was the result of that launch?",
              translation: "那次发布取得了什么成果？",
              feedback: {
                encouragement: "你清楚说明了自己的职责。",
                grammarScore: 94,
                vocabularyScore: 88,
                corrections: []
              }
            })
          };
        }
      };
    }
  });

  const result = await service.respond(payload);
  assert.equal(result.feedback.grammarScore, 94);
  assert.equal(requestBody.model, "test-model");
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.match(requestBody.input, /product launch/);
  assert.match(requestBody.input, /Tell me about yourself/);
});

test("AI coach is unavailable without a server-side key", async () => {
  const service = createCoachService({ apiKey: "" });
  assert.equal(service.available, false);
  await assert.rejects(service.respond(payload), /OPENAI_API_KEY/);
});

test("AI coach streams structured output deltas", async () => {
  const parts = [
    JSON.stringify({ coachReply: "Tell me more.", translation: "请继续。", feedback: { encouragement: "很好。", grammarScore: 90, vocabularyScore: 88, corrections: [] } }).slice(0, 50),
    JSON.stringify({ coachReply: "Tell me more.", translation: "请继续。", feedback: { encouragement: "很好。", grammarScore: 90, vocabularyScore: 88, corrections: [] } }).slice(50)
  ];
  const service = createCoachService({
    apiKey: "test-key",
    request: async (_url, options) => ({
      ok: true,
      body: {
        async *[Symbol.asyncIterator]() {
          for (const delta of parts) yield new TextEncoder().encode(`data: ${JSON.stringify({ type: "response.output_text.delta", delta })}\n\n`);
        }
      },
      requestedBody: options.body
    })
  });
  const deltas = [];
  const result = await service.respondStream(payload, delta => deltas.push(delta));
  assert.equal(result.feedback.grammarScore, 90);
  assert.equal(deltas.length, 2);
});
