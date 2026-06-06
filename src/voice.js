const phraseTranslations = [
  ["That's a clear answer.", "回答很清晰。"],
  ["Good start. Try adding one specific detail.", "开头不错，试着补充一个具体细节。"],
  ["Nice use of polite, natural phrasing.", "礼貌且自然的表达用得很好。"],
  ["Good reasoning. You explained that clearly.", "理由充分，解释得很清楚。"],
  ["What achievement are you most proud of?", "你最自豪的成就是什么？"],
  ["Tell me about a challenge you faced and how you handled it.", "说说你遇到过的挑战，以及你是如何处理的。"],
  ["Why are you interested in this role?", "你为什么对这个职位感兴趣？"],
  ["Would you like to hear today's specials?", "你想听听今天的特色菜吗？"],
  ["How would you like your steak cooked?", "你的牛排想要几分熟？"],
  ["Can I get you anything else?", "还需要其他东西吗？"],
  ["What is the biggest risk we should watch?", "我们最需要关注的风险是什么？"],
  ["Do you agree with the proposed timeline?", "你同意建议的时间安排吗？"],
  ["What support do you need from the team?", "你需要团队提供什么支持？"],
  ["Would you rather take the subway or walk?", "你更愿意坐地铁还是步行？"],
  ["Do you need help buying a ticket?", "你需要帮忙买票吗？"],
  ["Is there anything else you'd like to visit nearby?", "附近还有其他你想去的地方吗？"]
];

export const openingTranslations = {
  interview: "你好，感谢你今天参加面试。可以先简单介绍一下自己吗？",
  restaurant: "晚上好，欢迎来到 Olive Kitchen。请问你有预订吗？",
  meeting: "大家早上好。我们先快速汇报进度，你负责的项目部分进展如何？",
  travel: "你好，你看起来有些迷路。你想去哪里吗？"
};

export function translateCoachText(text, scenarioId) {
  if (openingTranslations[scenarioId] && text === getOpeningEnglish(scenarioId)) {
    return openingTranslations[scenarioId];
  }

  const translated = phraseTranslations
    .filter(([english]) => text.includes(english))
    .map(([, chinese]) => chinese);
  return translated.length ? translated.join(" ") : "中文翻译将在完整语句识别后显示。";
}

function getOpeningEnglish(scenarioId) {
  return {
    interview: "Hi! Thanks for joining us today. Could you start by telling me a little about yourself?",
    restaurant: "Good evening! Welcome to Olive Kitchen. Do you have a reservation with us?",
    meeting: "Morning, everyone. Let's start with a quick progress update. How is your part of the project going?",
    travel: "Hi there! You look a little lost. Is there somewhere you're trying to get to?"
  }[scenarioId];
}

export function recognitionTranscript(results) {
  let finalText = "";
  let interimText = "";
  for (const result of results) {
    if (result.isFinal) finalText += `${result[0].transcript} `;
    else interimText += result[0].transcript;
  }
  return { finalText: finalText.trim(), interimText: interimText.trim() };
}
