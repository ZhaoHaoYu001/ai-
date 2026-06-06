export function createTranscriptionClient({
  endpoint = "/api/transcribe",
  request = fetch
} = {}) {
  return {
    async transcribe(audio) {
      if (!audio?.size) throw new Error("No recorded audio is available");
      const response = await request(endpoint, {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: audio
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 503) throw new Error("语音转写服务暂不可用。请使用下方文字输入框继续练习。");
      if (!response.ok) throw new Error(result.error || "Speech transcription failed");
      if (!result.text?.trim()) throw new Error("Speech transcription returned no text");
      return result;
    }
  };
}

export async function prepareLocalRecognition(SpeechRecognition, language = "en-US") {
  if (!SpeechRecognition?.available) return false;
  try {
    const options = { langs: [language], processLocally: true };
    let availability = await SpeechRecognition.available(options);
    if (availability === "downloadable" || availability === "downloading") {
      if (!SpeechRecognition.install || !await SpeechRecognition.install(options)) return false;
      availability = await SpeechRecognition.available(options);
    }
    return availability === "available";
  } catch {
    return false;
  }
}
