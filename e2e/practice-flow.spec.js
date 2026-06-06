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

test("completes the full text fallback practice flow", async ({ page }) => {
  await mockBrowserVoice(page);
  await page.goto("/");
  await page.getByText("求职面试", { exact: true }).click();
  await page.getByRole("button", { name: "填入演示回答" }).click();
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
  await expect(page.getByRole("button", { name: "● 开启持续转写" })).toBeVisible();
  await expect(page.getByPlaceholder("也可以输入英文回答…")).toBeEnabled();
});

test("keeps the core practice workflow usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBrowserVoice(page);
  await page.goto("/");
  await page.getByText("工作会议", { exact: true }).click();
  await expect(page.locator(".practice aside")).toBeHidden();
  await expect(page.locator(".conversation")).toBeVisible();
  await expect(page.getByPlaceholder("也可以输入英文回答…")).toBeVisible();
});
