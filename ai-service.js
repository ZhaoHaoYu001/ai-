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

function parseStructuredText(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    // Some compatible models occasionally emit trailing commas despite a strict JSON prompt.
    return JSON.parse(trimmed.replace(/,\s*([}\]])/g, "$1"));
  }
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

function anthropicEndpoint(baseUrl) {
  return `${String(baseUrl).replace(/\/+$/, "")}/v1/messages`;
}

function anthropicBody(model, payload, stream = false) {
  return {
    model,
    max_tokens: 2400,
    stream,
    system: `Return only compact valid JSON matching this JSON Schema. Do not include markdown, comments, or analysis:\n${JSON.stringify(responseSchema)}`,
    messages: [{ role: "user", content: buildPrompt(payload) }]
  };
}

export function createCoachService({
  provider = (process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY) ? "anthropic" : "openai",
  apiKey = provider === "anthropic" ? (process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY) : process.env.OPENAI_API_KEY,
  baseUrl = provider === "anthropic" ? (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") : "https://api.openai.com",
  model = provider === "anthropic" ? (process.env.ANTHROPIC_MODEL || "mimo-v2.5") : (process.env.OPENAI_MODEL || "gpt-5.4-mini"),
  request = globalThis.fetch
} = {}) {
  const headers = provider === "anthropic" ? {
    Authorization: `Bearer ${apiKey}`,
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json"
  } : {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
  return {
    provider,
    model,
    available: Boolean(apiKey),
    async respond(payload) {
      if (!apiKey) throw new Error(`${provider} API credential is not configured`);

      const response = await request(provider === "anthropic" ? anthropicEndpoint(baseUrl) : `${baseUrl}/v1/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify(provider === "anthropic" ? anthropicBody(model, payload) : responseBody(model, payload))
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`${provider} request failed (${response.status}): ${detail.slice(0, 200)}`);
      }
      const result = await response.json();
      const text = provider === "anthropic" ? result.content?.find(item => item.type === "text")?.text : outputText(result);
      if (!text) throw new Error(`${provider} response did not contain output text`);
      return parseStructuredText(text);
    },
    async respondStream(payload, onDelta = () => {}) {
      if (!apiKey) throw new Error(`${provider} API credential is not configured`);
      const response = await request(provider === "anthropic" ? anthropicEndpoint(baseUrl) : `${baseUrl}/v1/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify(provider === "anthropic" ? anthropicBody(model, payload, true) : responseBody(model, payload, true))
      });
      if (!response.ok || !response.body) throw new Error(`${provider} streaming request failed (${response.status})`);

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
          const delta = provider === "anthropic" && parsed.type === "content_block_delta" ? parsed.delta?.text :
            parsed.type === "response.output_text.delta" ? parsed.delta : null;
          if (typeof delta === "string") {
            output += delta;
            onDelta(delta);
          }
        }
      }
      return parseStructuredText(output);
    }
  };
}
