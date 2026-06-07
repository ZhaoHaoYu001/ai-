const cleanList = (value, fallback, limit) => {
  const items = Array.isArray(value) ? value : [];
  return [...items, ...fallback]
    .map(item => String(item || "").trim())
    .filter((item, index, all) => item && all.indexOf(item) === index)
    .slice(0, limit);
};

export function normalizeAnswerSupport(value, fallback) {
  const fallbackExamples = fallback.examples || [fallback.example];
  const examples = cleanList(value?.examples || [value?.example], fallbackExamples, 3);
  return {
    starters: cleanList(value?.starters, fallback.starters, 3),
    keywords: cleanList(value?.keywords, fallback.keywords, 4),
    example: examples[0],
    examples
  };
}

export function contextualAnswerSupport(scenario, question = "") {
  const text = question.toLowerCase();
  const choices = [
    {
      matches: /result|achievement|achieve|measure success|impact/,
      support: {
        starters: ["The result was...", "We measured success by...", "This led to..."],
        keywords: ["result", "increased", "reduced", "impact"],
        example: "The result was a 20% increase in adoption, and we reduced support requests after launch."
      }
    },
    {
      matches: /challenge|difficult|handled|improve next time/,
      support: {
        starters: ["The main challenge was...", "I decided to...", "Looking back, I would..."],
        keywords: ["challenge", "action", "because", "learned"],
        example: "The main challenge was aligning the team, so I clarified priorities and set a weekly review."
      }
    },
    {
      matches: /why.*interest|why.*role|motivat/,
      support: {
        starters: ["I am interested because...", "This role matches...", "I could contribute by..."],
        keywords: ["interested", "strength", "contribute", "growth"],
        example: "I am interested because this role matches my product experience and lets me solve customer problems."
      }
    },
    {
      matches: /risk|timeline|support.*need/,
      support: {
        starters: ["The main risk is...", "To stay on schedule...", "I need support with..."],
        keywords: ["risk", "timeline", "priority", "next step"],
        example: "The main risk is delayed feedback, so I suggest confirming owners and deadlines today."
      }
    },
    {
      matches: /special|recommend|anything else|steak|order/,
      support: {
        starters: ["Could you recommend...?", "I would like...", "Could I also have...?"],
        keywords: ["recommend", "medium", "side dish", "bill"],
        example: "I would like the steak medium, and could you recommend a side dish to go with it?"
      }
    },
    {
      matches: /subway|walk|ticket|nearby|visit/,
      support: {
        starters: ["I would prefer to...", "How long does it take...?", "Could you show me...?"],
        keywords: ["subway", "walking", "transfer", "ticket"],
        example: "I would prefer to take the subway. How many stops is it, and do I need to transfer?"
      }
    }
  ];
  const contextual = choices.find(choice => choice.matches.test(text))?.support;
  return normalizeAnswerSupport(contextual, scenario.support);
}
