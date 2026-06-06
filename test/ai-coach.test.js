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
  assert.equal(result.analysis.assessmentMode, "ai");
  assert.equal(result.analysis.scores.grammar, 96);
  assert.match(result.coach.text, /measurable result/);
});

test("browser AI client clearly falls back when the service is unavailable", async () => {
  const client = createAiCoachClient({ request: async () => ({ ok: false, status: 503 }) });
  const result = await client.respond(context);
  assert.equal(result.mode, "offline");
  assert.match(result.coach.text, /achievement/i);
});
