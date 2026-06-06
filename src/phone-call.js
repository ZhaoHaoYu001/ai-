export function createVoiceActivityGate({
  speechThreshold = .035,
  silenceThreshold = .018,
  silenceMs = 1000,
  maxTurnMs = 45_000
} = {}) {
  let startedAt = null;
  let speechStartedAt = null;
  let silenceStartedAt = null;

  return {
    update({ peakLevel = 0, activeRatio = 0, hasTranscript = false } = {}, now = performance.now()) {
      startedAt ??= now;
      const speaking = hasTranscript || peakLevel >= speechThreshold || activeRatio >= .16;
      if (speaking) {
        speechStartedAt ??= now;
        silenceStartedAt = null;
      } else if (speechStartedAt && peakLevel <= silenceThreshold && activeRatio <= .08) {
        silenceStartedAt ??= now;
      }
      return {
        heardSpeech: Boolean(speechStartedAt),
        shouldFinish: Boolean(
          (silenceStartedAt && now - silenceStartedAt >= silenceMs) ||
          (speechStartedAt && now - startedAt >= maxTurnMs)
        )
      };
    }
  };
}

export function callPhaseCopy(phase) {
  return {
    connecting: ["正在接通 AI Coach", "正在准备麦克风与场景对话"],
    speaking: ["AI Coach 正在说话", "听完后会自动开始聆听你的回答"],
    listening: ["正在听你说", "自然表达即可，停顿后会自动发送"],
    thinking: ["AI Coach 正在思考", "正在评测发音并生成下一句回应"],
    ready: ["通话已暂停", "点击继续通话，或使用文字回答"],
    ended: ["通话已结束", "正在生成本次练习报告"]
  }[phase] || ["AI 语音通话", "准备开始真实场景练习"];
}
