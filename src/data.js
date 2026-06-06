export const scenarios = [
  {
    id: "interview", icon: "◎", title: "求职面试", en: "Job Interview",
    description: "模拟产品经理面试，练习清晰表达经历与成果。", level: "B2", time: "8–12 分钟",
    color: "#f36b4a", goal: "用 STAR 结构介绍经历，并清晰表达个人优势",
    opening: "Hi! Thanks for joining us today. Could you start by telling me a little about yourself?",
    prompts: ["What achievement are you most proud of?", "Tell me about a challenge you faced and how you handled it.", "Why are you interested in this role?"],
    support: {
      starters: ["I have experience in...", "One achievement I am proud of is...", "I was responsible for..."],
      keywords: ["experience", "responsible for", "result", "learned"],
      example: "I have three years of experience in product design, and I enjoy turning complex problems into simple experiences."
    },
    demo: "I have three years experience in product design. I very like turning complex problems into simple experiences."
  },
  {
    id: "restaurant", icon: "◇", title: "餐厅点餐", en: "At a Restaurant",
    description: "从订位到结账，掌握自然礼貌的餐厅英语。", level: "A2", time: "5–8 分钟",
    color: "#4aa489", goal: "完成订位确认、点餐、提出需求和结账",
    opening: "Good evening! Welcome to Olive Kitchen. Do you have a reservation with us?",
    prompts: ["Would you like to hear today's specials?", "How would you like your steak cooked?", "Can I get you anything else?"],
    support: {
      starters: ["I have a reservation under...", "Could I have...?", "Would it be possible to...?"],
      keywords: ["reservation", "table", "recommend", "bill"],
      example: "I have a reservation under Zhao. Could I have a table near the window, please?"
    },
    demo: "Yes, I have a reservation under Zhao. Could I also have a table near the window?"
  },
  {
    id: "meeting", icon: "△", title: "工作会议", en: "Team Meeting",
    description: "练习汇报进度、提出观点与回应同事。", level: "B1", time: "8–10 分钟",
    color: "#6279dc", goal: "结构化汇报进度，并自然表达赞同或不同意见",
    opening: "Morning, everyone. Let's start with a quick progress update. How is your part of the project going?",
    prompts: ["What is the biggest risk we should watch?", "Do you agree with the proposed timeline?", "What support do you need from the team?"],
    support: {
      starters: ["I have completed...", "The main risk is...", "I need support with..."],
      keywords: ["progress", "timeline", "risk", "next step"],
      example: "I have completed the user research. The next step is to confirm the launch timeline with the team."
    },
    demo: "My part is almost complete. I finished the user research, but we should discuss about the launch timeline."
  },
  {
    id: "travel", icon: "✦", title: "旅行问路", en: "Travel & Directions",
    description: "在陌生城市问路、购票并确认关键信息。", level: "A2", time: "5–7 分钟",
    color: "#dca43d", goal: "准确询问路线、交通方式与所需时间",
    opening: "Hi there! You look a little lost. Is there somewhere you're trying to get to?",
    prompts: ["Would you rather take the subway or walk?", "Do you need help buying a ticket?", "Is there anything else you'd like to visit nearby?"],
    support: {
      starters: ["Excuse me, how can I get to...?", "How long does it take...?", "Should I take...?"],
      keywords: ["subway", "walking distance", "transfer", "ticket"],
      example: "Excuse me, how can I get to the city museum? Is it faster to walk or take the subway?"
    },
    demo: "Excuse me, how can I get to the city museum? Is walking more better than taking the subway?"
  }
];

export const rules = [
  [/\bi am work\b/i, "I work", "描述当前职业时使用一般现在时。"],
  [/\bi have (\w+) years experience\b/i, "I have $1 years of experience", "experience 前通常搭配 of。"],
  [/\bi very like\b/i, "I really like", "修饰动词 like 应使用副词 really。"],
  [/\bdiscuss about\b/i, "discuss", "discuss 是及物动词，不需要 about。"],
  [/\bmore better\b/i, "better", "better 已经是比较级，无需再加 more。"]
];
