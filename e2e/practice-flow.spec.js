import { expect, test } from "@playwright/test";

async function mockBrowserVoice(page) {
  await page.addInitScript(() => {
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
          throw new DOMException("Permission denied", "NotAllowedError");
        }
      }
    });
  });
}

async function mockTurnRecognition(page) {
  await page.addInitScript(() => {
    window.__speechInstances = [];
    window.__emitFinalSpeech = text => {
      const instance = window.__speechInstances.at(-1);
      instance.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: text, confidence: .92 } }]
      });
    };
    window.__endRecognition = () => window.__speechInstances.at(-1).onend?.();
    class MockSpeechRecognition {
      constructor() { window.__speechInstances.push(this); }
      start() {}
      stop() { this.onend?.(); }
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: MockSpeechRecognition });
  });
}

test("completes the full text fallback practice flow", async ({ page }) => {
  await mockBrowserVoice(page);
  await page.goto("/");
  await page.getByText("求职面试", { exact: true }).click();
  await page.getByRole("button", { name: "填入纠错示例" }).click();
  await page.getByRole("button", { name: "↑" }).click();
  await expect(page.locator(".msg.user>div>p")).toContainText("I have three years experience");
  await expect(page.getByText("OFFLINE FALLBACK", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "↑" })).toBeEnabled();
  await page.getByRole("button", { name: "结束练习并查看报告" }).click();
  await expect(page.locator("main.report")).toBeVisible();
  await expect(page.getByText("本次练习洞察", { exact: true })).toBeVisible();
});

test("falls back cleanly when microphone permission is denied", async ({ page }) => {
  await mockBrowserVoice(page);
  await page.goto("/");
  await page.getByText("餐厅点餐", { exact: true }).click();
  await expect(page.getByRole("button", { name: "● 开始语音回答" })).toBeVisible();
  await expect(page.getByPlaceholder("也可以输入英文回答…")).toBeEnabled();
});

test("keeps speech across recognition reconnects and sends one explicit turn", async ({ page }) => {
  await mockBrowserVoice(page);
  await mockTurnRecognition(page);
  await page.goto("/");
  await page.getByText("求职面试", { exact: true }).click();
  await page.getByRole("button", { name: "● 开始语音回答" }).click();
  const support = page.locator(".answer-support");
  await expect(support.getByText("回答支架 · 录音时也可参考", { exact: true })).toBeVisible();
  await expect(support).toContainText("Could you start by telling me a little about yourself?");
  await expect(support).toContainText("I have experience in...");
  await expect(support).toContainText("I have three years of experience in product design");
  await expect(page.getByRole("button", { name: "填入纠错示例" })).toBeDisabled();
  await page.evaluate(() => window.__emitFinalSpeech("I led the launch"));
  await page.evaluate(() => window.__endRecognition());
  await expect(page.getByRole("button", { name: "■ 结束回答并发送" })).toBeVisible();
  await page.waitForTimeout(450);
  await page.evaluate(() => window.__emitFinalSpeech("and increased adoption"));
  await expect(page.getByText("I led the launch and increased adoption", { exact: true })).toBeVisible();
  await expect(page.locator(".msg.user")).toHaveCount(0);
  await page.getByRole("button", { name: "■ 结束回答并发送" }).click();
  await expect(page.locator(".msg.user>div>p")).toContainText("I led the launch and increased adoption");
  await expect(page.locator(".msg.user")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "● 开始语音回答" })).toBeVisible();
});

test("keeps the core practice workflow usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBrowserVoice(page);
  await page.goto("/");
  await page.getByText("工作会议", { exact: true }).click();
  await expect(page.locator(".practice aside")).toBeHidden();
  await expect(page.locator(".conversation")).toBeVisible();
  await expect(page.getByText("回答支架 · 录音时也可参考", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("也可以输入英文回答…")).toBeVisible();
});
