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
    provider: "openai",
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
  await assert.rejects(service.respond(payload), /credential is not configured/);
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

test("Anthropic-compatible coach sends Messages API requests and parses structured feedback", async () => {
  let requestUrl;
  let requestHeaders;
  let requestBody;
  const service = createCoachService({
    provider: "anthropic",
    apiKey: "test-anthropic-key",
    baseUrl: "https://example.test/anthropic/",
    model: "mimo-v2.5",
    request: async (url, options) => {
      requestUrl = url;
      requestHeaders = options.headers;
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return {
            content: [{
              type: "text",
              text: "```json\n" + JSON.stringify({
                coachReply: "How did your team measure success?",
                translation: "你的团队如何衡量成功？",
                feedback: { encouragement: "回答具体。", grammarScore: 93, vocabularyScore: 91, corrections: [] }
              }) + "\n```"
            }]
          };
        }
      };
    }
  });

  const result = await service.respond(payload);
  assert.equal(service.provider, "anthropic");
  assert.equal(requestUrl, "https://example.test/anthropic/v1/messages");
  assert.equal(requestHeaders.Authorization, "Bearer test-anthropic-key");
  assert.equal(requestHeaders["x-api-key"], "test-anthropic-key");
  assert.equal(requestBody.model, "mimo-v2.5");
  assert.match(requestBody.messages[0].content, /product launch/);
  assert.equal(result.feedback.grammarScore, 93);
});

test("Anthropic-compatible coach consumes Messages API stream deltas", async () => {
  const resultText = JSON.stringify({
    coachReply: "What would you improve next time?",
    translation: "下次你会改进什么？",
    feedback: { encouragement: "表达清晰。", grammarScore: 95, vocabularyScore: 92, corrections: [] }
  });
  const parts = [resultText.slice(0, 60), resultText.slice(60)];
  const service = createCoachService({
    provider: "anthropic",
    apiKey: "test-anthropic-key",
    request: async () => ({
      ok: true,
      body: {
        async *[Symbol.asyncIterator]() {
          for (const text of parts) {
            yield new TextEncoder().encode(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text } })}\n\n`);
          }
        }
      }
    })
  });
  const deltas = [];
  const result = await service.respondStream(payload, delta => deltas.push(delta));
  assert.equal(result.feedback.grammarScore, 95);
  assert.deepEqual(deltas, parts);
});

test("Anthropic-compatible coach tolerates trailing commas in structured model output", async () => {
  const service = createCoachService({
    provider: "anthropic",
    apiKey: "test-anthropic-key",
    request: async () => ({
      ok: true,
      async json() {
        return {
          content: [{
            type: "text",
            text: '{"coachReply":"Try again.","translation":"再试一次。","feedback":{"encouragement":"继续加油。","grammarScore":80,"vocabularyScore":82,"corrections":[],},}'
          }]
        };
      }
    })
  });
  const result = await service.respond(payload);
  assert.equal(result.feedback.grammarScore, 80);
});
