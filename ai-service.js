const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["coachReply", "translation", "feedback"],
  properties: {
    coachReply: { type: "string" },
    translation: { type: "string" },
    feedback: {
      type: "object",
      additionalProperties: false,
      required: ["encouragement", "grammarScore", "vocabularyScore", "corrections"],
      properties: {
        encouragement: { type: "string" },
        grammarScore: { type: "integer", minimum: 0, maximum: 100 },
        vocabularyScore: { type: "integer", minimum: 0, maximum: 100 },
        corrections: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["original", "improved", "reason"],
            properties: {
              original: { type: "string" },
              improved: { type: "string" },
              reason: { type: "string" }
            }
          }
        }
      }
    }
  }
};

function buildPrompt({ scenario, messages, answer }) {
  const history = messages
    .map(message => `${message.role === "coach" ? "Coach" : "Learner"}: ${message.text}`)
    .join("\n");

  return `You are FluentLoop, an English speaking coach role-playing a realistic scenario.

Scenario: ${scenario.title}
Learner level: ${scenario.level}
Training goal: ${scenario.goal}

Conversation so far:
${history}
Learner's latest answer: ${answer}

Continue the role-play naturally. Ask one concise, context-aware follow-up question.
Do not repeat a question already asked. Keep coachReply under 45 words.
Give a natural Chinese translation of coachReply.
Assess grammar and vocabulary in context, not with keyword matching.
Only include corrections that materially improve the answer.
Correction reasons must be concise Chinese explanations.
Encouragement must be one short Chinese sentence and specific to this answer.`;
}

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") return content.text;
    }
  }
  throw new Error("AI response did not contain output text");
}

function responseBody(model, payload, stream = false) {
  return {
    model,
    input: buildPrompt(payload),
    stream,
    text: {
      format: {
        type: "json_schema",
        name: "speaking_coach_turn",
        strict: true,
        schema: responseSchema
      }
    }
  };
}

export function createCoachService({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || "gpt-5.4-mini",
  request = globalThis.fetch
} = {}) {
  return {
    available: Boolean(apiKey),
    async respond(payload) {
      if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

      const response = await request("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(responseBody(model, payload))
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 200)}`);
      }

      return JSON.parse(outputText(await response.json()));
    },
    async respondStream(payload, onDelta = () => {}) {
      if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
      const response = await request("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(responseBody(model, payload, true))
      });
      if (!response.ok || !response.body) throw new Error(`OpenAI streaming request failed (${response.status})`);

      const decoder = new TextDecoder();
      let pending = "";
      let output = "";
      for await (const chunk of response.body) {
        pending += decoder.decode(chunk, { stream: true });
        const events = pending.split("\n\n");
        pending = events.pop() || "";
        for (const event of events) {
          const data = event.split("\n").find(line => line.startsWith("data: "))?.slice(6);
          if (!data || data === "[DONE]") continue;
          const parsed = JSON.parse(data);
          if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
            output += parsed.delta;
            onDelta(parsed.delta);
          }
        }
      }
      return JSON.parse(output);
    }
  };
}
