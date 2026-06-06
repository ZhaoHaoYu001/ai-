import { expect, test } from "@playwright/test";

async function mockBrowserVoice(page, microphone = "denied") {
  await page.addInitScript(mode => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speaking: false,
        paused: false,
        cancel() {},
        pause() { this.paused = true; },
        resume() { this.paused = false; },
        speak(utterance) { setTimeout(() => utterance.onend?.(), 0); }
      }
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(text) { this.text = text; }
      }
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        async getUserMedia() {
          if (mode === "pending") return new Promise(() => {});
          throw new DOMException("Permission denied", "NotAllowedError");
        }
      }
    });
  }, microphone);
}

async function mockTurnRecognition(page) {
  await page.addInitScript(() => {
    window.FLUENTLOOP_AUDIO_CAPTURE_FACTORY = async () => ({
      beginUtterance() {},
      snapshot: () => ({ averageLevel: .05, peakLevel: .08, activeRatio: .4 }),
      utteranceBlob: () => new Blob(["RIFFdemo"], { type: "audio/wav" }),
      stop: async () => new Blob(["session"], { type: "audio/webm" })
    });
    window.__speechInstances = [];
    window.__emitFinalSpeech = text => {
      const instance = window.__speechInstances.at(-1);
      instance.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: text, confidence: .92 } }]
      });
    };
    window.__endRecognition = () => window.__speechInstances.at(-1).onend?.();
    window.__emitSpeechError = error => window.__speechInstances.at(-1).onerror?.({ error });
    class MockSpeechRecognition {
      constructor() { window.__speechInstances.push(this); }
      start() {}
      stop() { this.onend?.(); }
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: MockSpeechRecognition });
  });
}

async function mockServerTranscriptionFallback(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speaking: false, paused: false, cancel() {}, speak(utterance) { setTimeout(() => utterance.onend?.(), 0); } }
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class { constructor(text) { this.text = text; } }
    });
    window.__voiceSnapshot = { averageLevel: .1, peakLevel: .2, activeRatio: .8 };
    window.FLUENTLOOP_AUDIO_CAPTURE_FACTORY = async () => ({
      beginUtterance() {},
      snapshot: () => window.__voiceSnapshot,
      utteranceBlob: () => new Blob(["RIFFdemo"], { type: "audio/wav" }),
      stop: async () => new Blob(["session"], { type: "audio/webm" })
    });
    window.FLUENTLOOP_TRANSCRIPTION_SERVICE = {
      request: async () => ({ ok: true, status: 200, json: async () => ({ text: "I led the launch", confidence: .91 }) })
    };
  });
}

test("completes the full text fallback practice flow", async ({ page }) => {
  await mockBrowserVoice(page);
  await page.goto("/");
  await page.getByText("求职面试", { exact: true }).click();
  await expect(page.getByPlaceholder("语音不可用时，也可以输入英文回答…")).toBeEnabled();
  await page.getByRole("button", { name: "填入纠错示例" }).click();
  await page.getByRole("button", { name: "↑" }).click();
  await expect(page.locator(".msg.user>div>p")).toContainText("I have three years experience");
  await expect(page.getByText("OFFLINE FALLBACK", { exact: true })).toBeVisible();
  await expect(page.locator(".answer-support")).toContainText("The result was...");
  await expect(page.getByRole("button", { name: "↑" })).toBeEnabled();
  await page.getByRole("button", { name: "结束练习并查看报告" }).click();
  await expect(page.locator("main.report")).toBeVisible();
  await expect(page.getByText("本次练习洞察", { exact: true })).toBeVisible();
});

test("falls back cleanly when microphone permission is denied", async ({ page }) => {
  await mockBrowserVoice(page);
  await page.goto("/");
  await page.getByText("餐厅点餐", { exact: true }).click();
  await page.getByRole("button", { name: "继续通话" }).click();
  await expect(page.getByText(/麦克风无法启动/)).toBeVisible();
  await expect(page.getByRole("button", { name: "继续通话" })).toBeVisible();
  await expect(page.getByPlaceholder("语音不可用时，也可以输入英文回答…")).toBeEnabled();
});

test("keeps speech across recognition reconnects and sends one explicit turn", async ({ page }) => {
  await mockBrowserVoice(page, "pending");
  await mockTurnRecognition(page);
  await page.goto("/");
  await page.getByText("求职面试", { exact: true }).click();
  await expect(page.getByText(/请点击“继续通话”并允许麦克风权限/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__speechInstances.length)).toBe(0);
  await page.getByRole("button", { name: "继续通话" }).click();
  await expect(page.getByText("麦克风录音已就绪，可生成发音评测", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__speechInstances.length)).toBe(1);
  const support = page.locator(".answer-support");
  await expect(support.getByText("上下文回答建议 · 通话中也可参考", { exact: true })).toBeVisible();
  await expect(support).toContainText("Could you start by telling me a little about yourself?");
  await expect(support).toContainText("I have experience in...");
  await expect(support).toContainText("I have three years of experience in product design");
  await expect(page.getByRole("button", { name: "填入纠错示例" })).toBeDisabled();
  await page.evaluate(() => window.__emitFinalSpeech("I led the launch"));
  await page.evaluate(() => window.__endRecognition());
  await expect(page.getByRole("button", { name: "结束本轮" })).toBeVisible();
  await page.waitForTimeout(450);
  await page.evaluate(() => window.__emitFinalSpeech("and increased adoption"));
  await expect(page.getByText("I led the launch and increased adoption", { exact: true })).toBeVisible();
  await expect(page.locator(".msg.user")).toHaveCount(0);
  await page.getByRole("button", { name: "结束本轮" }).click();
  await expect(page.locator(".msg.user>div>p")).toContainText("I led the launch and increased adoption");
  await expect(page.locator(".msg.user")).toHaveCount(1);
  await expect(page.getByText("AI 场景语音通话", { exact: true })).toBeVisible();
});

test("uses the recorded turn when browser recognition returns no text", async ({ page }) => {
  await mockServerTranscriptionFallback(page);
  await page.goto("/");
  await page.getByText("求职面试", { exact: true }).click();
  await page.getByRole("button", { name: "继续通话" }).click();
  await expect(page.getByText("麦克风录音已就绪，可生成发音评测", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "结束本轮" }).click();
  await expect(page.locator(".msg.user>div>p")).toContainText("I led the launch");
});

test("automatically sends a phone turn after the learner stops speaking", async ({ page }) => {
  await mockServerTranscriptionFallback(page);
  await page.goto("/");
  await page.getByText("求职面试", { exact: true }).click();
  await page.getByRole("button", { name: "继续通话" }).click();
  await expect(page.getByRole("button", { name: "结束本轮" })).toBeVisible();
  await page.waitForTimeout(350);
  await page.evaluate(() => { window.__voiceSnapshot = { averageLevel: 0, peakLevel: 0, activeRatio: 0 }; });
  await expect(page.locator(".msg.user>div>p")).toContainText("I led the launch", { timeout: 5000 });
});

test("keeps recording after the browser recognition service fails", async ({ page }) => {
  await mockServerTranscriptionFallback(page);
  await mockTurnRecognition(page);
  await page.goto("/");
  await page.getByText("求职面试", { exact: true }).click();
  await page.getByRole("button", { name: "继续通话" }).click();
  await expect(page.getByRole("button", { name: "结束本轮" })).toBeVisible();
  await page.evaluate(() => window.__emitSpeechError("service-not-allowed"));
  await expect(page.getByText(/浏览器实时转写不可用/)).toBeVisible();
  await expect(page.getByRole("button", { name: "结束本轮" })).toBeVisible();
  await page.getByRole("button", { name: "结束本轮" }).click();
  await expect(page.locator(".msg.user>div>p")).toContainText("I led the launch");
});

test("keeps the core practice workflow usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBrowserVoice(page);
  await page.goto("/");
  await page.getByText("工作会议", { exact: true }).click();
  await expect(page.locator(".practice aside")).toBeHidden();
  await expect(page.locator(".conversation")).toBeVisible();
  await expect(page.getByText("上下文回答建议 · 通话中也可参考", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("语音不可用时，也可以输入英文回答…")).toBeVisible();
});
