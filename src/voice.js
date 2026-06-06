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
  const confidences = [];
  for (const result of results) {
    if (result.isFinal) {
      finalText += `${result[0].transcript} `;
      if (Number.isFinite(result[0].confidence)) confidences.push(result[0].confidence);
    }
    else interimText += result[0].transcript;
  }
  return {
    finalText: finalText.trim(),
    interimText: interimText.trim(),
    confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0
  };
}

export function appendTurnTranscript(currentText, nextText) {
  return `${currentText || ""} ${nextText || ""}`.replace(/\s+/g, " ").trim();
}

export function encodePcmWav(chunks, inputSampleRate, outputSampleRate = 16000) {
  const input = new Float32Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    input.set(chunk, offset);
    offset += chunk.length;
  }
  const ratio = inputSampleRate / outputSampleRate;
  const output = new Float32Array(Math.max(1, Math.floor(input.length / ratio)));
  for (let index = 0; index < output.length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let source = start; source < end && source < input.length; source += 1) sum += input[source];
    output[index] = sum / Math.max(1, Math.min(end, input.length) - start);
  }
  const buffer = new ArrayBuffer(44 + output.length * 2);
  const view = new DataView(buffer);
  const write = (position, value) => [...value].forEach((character, index) => view.setUint8(position + index, character.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + output.length * 2, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, outputSampleRate, true); view.setUint32(28, outputSampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, output.length * 2, true);
  output.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true));
  return new Blob([buffer], { type: "audio/wav" });
}

export function requestMicrophoneStream({
  mediaDevices = navigator.mediaDevices,
  timeoutMs = 8000
} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error("Microphone permission request timed out"));
    }, timeoutMs);
    mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    }).then(stream => {
      if (settled) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(stream);
    }, error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function createAudioCapture({ timeoutMs = 8000 } = {}) {
  const stream = await requestMicrophoneStream({
    timeoutMs
  });
  const context = new AudioContext();
  if (context.state === "suspended") await context.resume().catch(() => {});
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const silentOutput = context.createGain();
  silentOutput.gain.value = 0;
  source.connect(processor);
  processor.connect(silentOutput);
  silentOutput.connect(context.destination);
  const pcmChunks = [];
  let utterancePcmStart = 0;
  processor.onaudioprocess = event => pcmChunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  const samples = new Uint8Array(analyser.fftSize);
  const levels = [];
  let active = true;
  let frame;

  const sample = () => {
    analyser.getByteTimeDomainData(samples);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
    levels.push(rms);
    if (levels.length > 600) levels.shift();
    if (active) frame = requestAnimationFrame(sample);
  };
  sample();

  const chunks = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.start(1000);

  return {
    beginUtterance() {
      utterancePcmStart = pcmChunks.length;
    },
    snapshot() {
      const recent = levels.slice(-120);
      return {
        averageLevel: recent.length ? recent.reduce((sum, level) => sum + level, 0) / recent.length : 0,
        peakLevel: recent.length ? Math.max(...recent) : 0,
        activeRatio: recent.length ? recent.filter(level => level > .025).length / recent.length : 0
      };
    },
    utteranceBlob() {
      const blob = encodePcmWav(pcmChunks.slice(utterancePcmStart), context.sampleRate);
      utterancePcmStart = pcmChunks.length;
      return blob;
    },
    stop() {
      return new Promise(resolve => {
        active = false;
        cancelAnimationFrame(frame);
        recorder.onstop = () => {
          stream.getTracks().forEach(track => track.stop());
          context.close();
          resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        };
        recorder.stop();
      });
    }
  };
}
