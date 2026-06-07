export function createVoiceActivityGate({
  speechThreshold = .04,
  silenceThreshold = .018,
  speechConfirmMs = 750,
  silenceMs = 2400,
  confidentSilenceMs = 1800,
  confidentTranscriptWords = 8,
  confidentTurnMs = 4000,
  minimumTurnMs = 2500,
  maxTurnMs = 60_000
} = {}) {
  let startedAt = null;
  let speechStartedAt = null;
  let speechCandidateAt = null;
  let silenceStartedAt = null;

  return {
    update({ averageLevel = 0, peakLevel = 0, activeRatio = 0, hasTranscript = false, transcriptWords = 0 } = {}, now = performance.now()) {
      startedAt ??= now;
      const audioLooksLikeSpeech = peakLevel >= speechThreshold &&
        averageLevel >= silenceThreshold &&
        activeRatio >= .18;
      const speaking = hasTranscript || audioLooksLikeSpeech;
      if (speaking) {
        speechCandidateAt ??= now;
        if (hasTranscript || now - speechCandidateAt >= speechConfirmMs) {
          speechStartedAt ??= speechCandidateAt;
        }
        silenceStartedAt = null;
      } else {
        if (speechStartedAt === null) speechCandidateAt = null;
        if (speechStartedAt !== null && peakLevel <= silenceThreshold && activeRatio <= .08) {
          silenceStartedAt ??= now;
        }
      }
      const turnDuration = now - startedAt;
      const silenceTargetMs = transcriptWords >= confidentTranscriptWords && turnDuration >= confidentTurnMs ?
        confidentSilenceMs : silenceMs;
      const silentForMs = silenceStartedAt === null ? 0 : now - silenceStartedAt;
      return {
        heardSpeech: speechStartedAt !== null,
        confirmingSpeech: speechCandidateAt !== null && speechStartedAt === null,
        silenceTargetMs,
        silentForMs,
        shouldFinish: Boolean(
          (silenceStartedAt && turnDuration >= minimumTurnMs && silentForMs >= silenceTargetMs) ||
          (speechStartedAt !== null && now - startedAt >= maxTurnMs)
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
    ended: ["正在保存最后一轮", "完成转写、评测与纠错后生成练习报告"]
  }[phase] || ["AI 语音通话", "准备开始真实场景练习"];
}
